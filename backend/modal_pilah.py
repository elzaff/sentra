"""CMRE Pilah: product backend on Modal. Places new e-waste photos exactly like the paper pipeline (v4).

Frozen backbones (SigLIP2-So400m, PE-Core-G, DINOv3-H+, flip TTA, same preprocessing as pipeline/embed_new.py)
-> CMRE projection, fusion PCA-32 and cluster centres from artifacts.npz (build_artifacts.py) -> nearest centre,
5 most similar BDC photos, kNN-OOD alarm (10th neighbour > p95). Photos from Setoran/Batch sessions are kept (768 px,
EXIF stripped) in a private Biznet GIO bucket under a random key and shown through short-lived presigned URLs; photos
from "Uji dataset sendiri" are never stored.

Setup (once):   modal secret create huggingface-secret HF_TOKEN=hf_...      (account with DINOv3 access)
                Modal secret BucketBiznnet with BIZNET_S3_{ENDPOINT,REGION,BUCKET,ACCESS_KEY,SECRET_KEY}
Storage check:  modal run backend/modal_pilah.py::storage_check
Parity test:    needs the BDC photos, so it only runs from the original research project (code/product/)
Deploy:         MODAL_PROFILE=yaraxoaraal modal deploy backend/modal_pilah.py
"""
import functools
import io
import os
import re
import uuid

import modal

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_FILES, MAX_BYTES = 24, 12 * 1024 * 1024
ORIGINS = ["https://www.sentrahub.tech", "https://sentrahub.tech", "https://sentra-ewaste.vercel.app", "https://elzaff.github.io",
           "http://localhost:8766", "http://127.0.0.1:8766"]
SUPABASE_URL, ADMIN_UID = "https://qshhmvuuqjuxullvston.supabase.co", "c9b675a2-553e-4ef7-88ec-29bd1ffd4e69"
SUPABASE_KEY = "sb_publishable_fp8qYzvg3SfM8pWwr67TQQ_MY_ifJYe"  # public by design; the login itself is what is secret


def admin_only():
    """FastAPI dependency: reads stay open, but anything that spends GPU or writes needs the admin's Supabase login."""
    import json
    import urllib.request

    from fastapi import Header, HTTPException

    def check(authorization: str = Header("")):
        req = urllib.request.Request(f"{SUPABASE_URL}/auth/v1/user", headers={"apikey": SUPABASE_KEY, "Authorization": authorization})
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                uid = json.load(r).get("id")
        except Exception:
            raise HTTPException(401, "Login dulu.")
        if uid != ADMIN_UID:
            raise HTTPException(403, "Akun ini tidak punya akses.")
    return check

image = (modal.Image.debian_slim(python_version="3.12")
         .pip_install("torch==2.7.1", "transformers>=4.57,<5", "timm>=1.0.19", "huggingface_hub>=0.34", "pillow",
                      "numpy", "scikit-learn", "sentencepiece", "protobuf", "fastapi[standard]", "python-multipart")
         .pip_install("boto3")  # own layer so the torch layer above stays cached
         .env({"HF_HOME": "/cache/hf"})
         .add_local_file(f"{HERE}/artifacts.npz", "/root/artifacts.npz"))
light = modal.Image.debian_slim(python_version="3.12").pip_install("boto3", "fastapi[standard]")  # photo service: no GPU stack
store = modal.Secret.from_name("BucketBiznnet")  # BIZNET_S3_ENDPOINT / REGION / BUCKET / ACCESS_KEY / SECRET_KEY
app = modal.App("cmre-pilah", image=image)
cache = modal.Volume.from_name("cmre-pilah-hf", create_if_missing=True)

SIG = "google/siglip2-so400m-patch16-naflex"
DINO = "facebook/dinov3-vith16plus-pretrain-lvd1689m"
PE = "timm/vit_pe_core_gigantic_patch14_448.fb"
IMN = ([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])


def l2(x):
    import numpy as np
    return x / (np.linalg.norm(x, axis=1, keepdims=True) + 1e-8)


# ---- photo storage: private Biznet GIO bucket (S3 API). Keys are server-made random ids, never client input.
PID = re.compile(r"^[0-9a-f]{32}$")
PRESIGN_TTL = 900  # seconds a displayed photo URL stays valid


@functools.cache
def s3():
    import boto3
    from botocore.config import Config
    e = os.environ
    ep = e["BIZNET_S3_ENDPOINT"].strip().rstrip("/")
    return boto3.client(
        "s3", endpoint_url=ep if "://" in ep else "https://" + ep, region_name=e["BIZNET_S3_REGION"].strip(),
        aws_access_key_id=e["BIZNET_S3_ACCESS_KEY"].strip(), aws_secret_access_key=e["BIZNET_S3_SECRET_KEY"].strip(),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                      # boto3 >= 1.36 adds CRC32 trailers by default; many S3-compatible stores reject them
                      request_checksum_calculation="when_required", response_checksum_validation="when_required",
                      retries={"max_attempts": 3, "mode": "standard"}, connect_timeout=5, read_timeout=20))


def bucket():
    return os.environ["BIZNET_S3_BUCKET"].strip()


def put_photo(jpeg: bytes) -> str:
    pid = uuid.uuid4().hex
    s3().put_object(Bucket=bucket(), Key=f"photos/{pid}.jpg", Body=jpeg, ContentType="image/jpeg",
                    CacheControl="private, max-age=31536000, immutable")
    return pid


@app.cls(gpu="L4", volumes={"/cache": cache}, secrets=[modal.Secret.from_name("huggingface-secret"), store],
         scaledown_window=180, timeout=600, max_containers=1)  # public URL: at most one L4, off after 3 idle minutes
class Pilah:
    @modal.enter()
    def load(self):
        import numpy as np
        import timm
        import torch
        from transformers import AutoModel, AutoProcessor
        self.torch, self.np = torch, np
        self.sm = AutoModel.from_pretrained(SIG, dtype=torch.float16).cuda().eval()
        self.sp = AutoProcessor.from_pretrained(SIG)
        self.dm = AutoModel.from_pretrained(DINO, dtype=torch.bfloat16).cuda().eval()
        self.pm = timm.create_model(f"hf-hub:{PE}", pretrained=True, num_classes=0).cuda().eval().to(torch.bfloat16)
        cache.commit()  # keep downloaded weights for the next cold start
        a = np.load("/root/artifacts.npz")
        self.a = {k: a[k] for k in a.files if k != "probe_path"}

    # ---- embedding: identical to embed_new.py (draft 768 -> RGB -> square BICUBIC resize, flip TTA)
    def _arrays(self, blobs, size):
        from PIL import Image
        out = []
        for b in blobs:
            im = Image.open(io.BytesIO(b))
            im.draft("RGB", (768, 768))
            out.append(self.np.asarray(im.convert("RGB").resize((size, size), Image.BICUBIC)))
        return self.np.stack(out)

    def _norm(self, arr, size, mean, std):
        torch = self.torch
        x = torch.from_numpy(arr).cuda().permute(0, 3, 1, 2).float() / 255
        if x.shape[-1] != size:
            x = torch.nn.functional.interpolate(x, size=(size, size), mode="bicubic", align_corners=False).clamp(0, 1)
        return (x - torch.tensor(mean, device="cuda")[:, None, None]) / torch.tensor(std, device="cuda")[:, None, None]

    def _tta(self, arr, f, batch=8):
        out = []
        for i in range(0, len(arr), batch):
            a = arr[i:i + batch]
            views = [l2(f(v).float().cpu().numpy()) for v in (a, a[:, :, ::-1].copy())]
            out.append(l2(views[0] + views[1]))
        return self.np.vstack(out)

    def embed(self, blobs):
        np, torch = self.np, self.torch
        a384, a448 = self._arrays(blobs, 384), self._arrays(blobs, 448)
        c = self.pm.pretrained_cfg

        def sig(a):
            x = self.sp(images=list(a), return_tensors="pt").to("cuda")
            x["pixel_values"] = x["pixel_values"].half()
            o = self.sm.get_image_features(**x)
            return getattr(o, "pooler_output", o)

        with torch.inference_mode():
            s = self._tta(a384, sig)
            d = self._tta(a448, lambda a: self.dm(pixel_values=self._norm(a, 224, *IMN).to(torch.bfloat16)).pooler_output)
            p = self._tta(a448, lambda a: self.pm(self._norm(a, c["input_size"][-1], c["mean"], c["std"]).to(torch.bfloat16)))
        A = self.a
        proj = lambda v, b: l2(v - (v @ b.T) @ b)
        x = l2(np.hstack([proj(s, A["b_sig"]), proj(p, A["b_pe"]), d]))
        z = l2((x - A["pca_mean"]) @ A["pca_comp"].T).astype(np.float32)
        xr = l2(np.hstack([s, p, d]))  # same photos without CMRE, for the in-app comparison
        zr = l2((xr - A["pca_raw_mean"]) @ A["pca_raw_comp"].T).astype(np.float32)
        return z, zr

    def place(self, z, zr):
        np, A = self.np, self.a
        res = []
        for v, vr in zip(z, zr):
            dc = np.linalg.norm(A["centres"] - v, axis=1)
            top = np.argsort(dc)[:3]
            dm = np.linalg.norm(A["z_main"] - v, axis=1)
            order = np.argsort(dm)
            score = float(dm[order[9]])  # distance to the 10th nearest BDC photo (KTI Eq. 5)
            nb = [int(j) for j in order[:40] if A["safe"][j]][:5]
            res.append(dict(cluster=int(top[0]), centres=[[int(k), round(float(dc[k]), 3)] for k in top],
                            score=round(score, 3), threshold=round(float(A["ood_thr"]), 3),
                            ood=bool(score > A["ood_thr"]),
                            nb=[int(A["ids"][j]) for j in nb], nbCluster=[int(A["cluster"][j]) for j in nb],
                            nbSim=[round(float(A["z_main"][j] @ v), 3) for j in nb],
                            rawCluster=int(np.linalg.norm(A["centres_raw"] - vr, axis=1).argmin()),
                            z=[round(float(t), 4) for t in v]))  # z is kept on the device for "Jenis baru"
        return res

    @modal.method()
    def parity(self, blobs):
        return self.embed(blobs)[0].tolist()

    @modal.asgi_app()
    def web(self):
        import time
        import uuid

        from concurrent.futures import ThreadPoolExecutor

        from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
        from fastapi.middleware.cors import CORSMiddleware
        from PIL import Image, ImageOps
        from pydantic import BaseModel, Field

        api = FastAPI(title="CMRE Pilah")
        admin = [Depends(admin_only())]
        api.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])

        @api.get("/health")
        def health():
            return {"ok": True, "clusters": int(len(self.a["centres"]))}

        @api.post("/predict", dependencies=admin)
        async def predict(files: list[UploadFile] = File(...), keep: list[str] = Form(default=[])):
            """keep[i] == "1" stores files[i] in the bucket (Setoran/Batch); anything else leaves it unstored (Uji)."""
            if not 0 < len(files) <= MAX_FILES:
                raise HTTPException(400, f"Kirim 1 sampai {MAX_FILES} foto per permintaan.")
            blobs, names, clean = [], [], []
            for f in files:
                b = await f.read()
                if len(b) > MAX_BYTES:
                    raise HTTPException(413, f"{f.filename}: lebih dari 12 MB.")
                try:
                    im = Image.open(io.BytesIO(b))
                    im.load()
                    # phone photos: honour the EXIF rotation; the BDC files the pipeline saw carry none
                    if im.getexif().get(0x0112, 1) != 1:
                        buf = io.BytesIO()
                        ImageOps.exif_transpose(im).convert("RGB").save(buf, "JPEG", quality=95)
                        b = buf.getvalue()
                    # stored copy: re-encoded decoded pixels only, so EXIF/GPS and any appended payload never reach the bucket
                    buf = io.BytesIO()
                    ImageOps.exif_transpose(im).convert("RGB").save(buf, "JPEG", quality=90)
                    clean.append(buf.getvalue())
                except Exception:
                    raise HTTPException(415, f"{f.filename}: bukan file gambar yang bisa dibaca.")
                blobs.append(b)
                names.append(f.filename)
            t0 = time.perf_counter()
            out = self.place(*self.embed(blobs))

            def keep_one(i):  # storage is best effort: a bucket outage must not break placement
                if i >= len(keep) or keep[i] != "1":
                    return None
                try:
                    return put_photo(clean[i])
                except Exception as e:
                    print(f"[store] put failed: {type(e).__name__}: {e}")
                    return None

            with ThreadPoolExecutor(4) as ex:
                pids = list(ex.map(keep_one, range(len(clean))))
            return {"results": [dict(name=nm, pid=p, **r) for nm, p, r in zip(names, pids, out)],
                    "ms": round(1000 * (time.perf_counter() - t0))}

        class Discover(BaseModel):
            z: list[list[float]] = Field(min_length=4, max_length=400)

        @api.post("/discover", dependencies=admin)
        def discover(req: Discover):
            """Group held photos (CMRE embeddings kept on the device) into candidate new types. Small sets, so
            average-linkage cosine clustering with K picked by silhouette; one group when there is no structure."""
            from sklearn.cluster import AgglomerativeClustering
            from sklearn.metrics import silhouette_score
            np = self.np
            Z = np.asarray(req.z, dtype=np.float32)
            if Z.ndim != 2 or Z.shape[1] != self.a["centres"].shape[1]:
                raise HTTPException(400, "Embedding tidak sesuai.")
            Z, n = l2(Z), len(Z)
            lab, sil, k = None, -1.0, 1
            for kk in range(2, min(8, n - 1) + 1):
                cand = AgglomerativeClustering(n_clusters=kk, metric="cosine", linkage="average").fit_predict(Z)
                s = float(silhouette_score(Z, cand, metric="cosine"))
                if s > sil:
                    lab, sil, k = cand, s, kk
            if lab is None or sil < 0.1:
                lab, k = np.zeros(n, int), 1
            groups = []
            for g in range(k):
                m = np.where(lab == g)[0]
                sim = Z[m] @ Z[m].T
                coh = float((sim.sum() - len(m)) / (len(m) * (len(m) - 1))) if len(m) > 1 else 1.0
                dc = np.linalg.norm(self.a["centres"] - Z[m].mean(0), axis=1)
                groups.append(dict(members=m.tolist(), cohesion=round(coh, 3), nearest=int(dc.argmin()), nearestDist=round(float(dc.min()), 3)))
            groups.sort(key=lambda g: -len(g["members"]))
            return {"k": k, "silhouette": round(sil, 3) if k > 1 else None, "groups": groups}

        return api


@app.function(image=light, secrets=[store], scaledown_window=120, max_containers=2)
@modal.asgi_app()
def photo():
    """Shows and deletes stored photos without waking the GPU. The bucket stays private: GET redirects to a presigned URL."""
    from fastapi import Depends, FastAPI, HTTPException, Response
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import RedirectResponse

    api = FastAPI(title="SENTRA foto")
    api.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "DELETE"], allow_headers=["*"])

    def check(pid):  # only ids this backend minted; arbitrary keys in the bucket can never be signed
        if not PID.fullmatch(pid):
            raise HTTPException(404, "Foto tidak ditemukan.")

    @api.get("/health")
    def health():
        s3().head_bucket(Bucket=bucket())
        return {"ok": True}

    @api.get("/p/{pid}")
    def show(pid: str):
        check(pid)
        url = s3().generate_presigned_url("get_object", Params={"Bucket": bucket(), "Key": f"photos/{pid}.jpg"}, ExpiresIn=PRESIGN_TTL)
        # browser may reuse the redirect for less than the URL lives, so a cached redirect never points at an expired link
        return RedirectResponse(url, 302, headers={"Cache-Control": f"private, max-age={PRESIGN_TTL // 3}"})

    @api.delete("/p/{pid}", status_code=204, dependencies=[Depends(admin_only())])
    def remove(pid: str):
        check(pid)
        s3().delete_object(Bucket=bucket(), Key=f"photos/{pid}.jpg")  # S3 delete is idempotent
        return Response(status_code=204)

    return api


@app.function(image=light, secrets=[store])
def storage_check():
    """Round trip against the real bucket: put -> presigned GET over plain HTTPS -> compare -> delete -> confirm gone."""
    import urllib.error
    import urllib.request
    body = b"\xff\xd8\xff\xe0sentra-storage-check" + os.urandom(64)
    pid = put_photo(body)
    key = f"photos/{pid}.jpg"
    try:
        s3().head_bucket(Bucket=bucket())
        url = s3().generate_presigned_url("get_object", Params={"Bucket": bucket(), "Key": key}, ExpiresIn=60)
        with urllib.request.urlopen(url, timeout=20) as r:
            assert r.read() == body and r.headers["Content-Type"] == "image/jpeg", "presigned GET returned different bytes/type"
        try:  # a bucket that is not private would answer 200 here
            urllib.request.urlopen(f"{s3().meta.endpoint_url}/{bucket()}/{key}", timeout=20)
            raise AssertionError("object is readable WITHOUT a signature: bucket/object is public")
        except urllib.error.HTTPError as e:
            assert e.code in (401, 403), f"unsigned GET gave {e.code}, expected 403"
        print("put ok, presigned GET ok, unsigned GET refused")
    finally:
        s3().delete_object(Bucket=bucket(), Key=key)
    try:
        s3().head_object(Bucket=bucket(), Key=key)
        raise AssertionError("delete did not remove the object")
    except s3().exceptions.ClientError as e:
        assert e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"), e
    print("delete ok\nstorage_check passed")


@app.local_entrypoint()
def main():
    """Parity check: re-embed three BDC photos from their pixels and compare with the frozen v4 features."""
    import numpy as np
    a = np.load(f"{HERE}/artifacts.npz")
    if "probe_path" not in a.files:
        raise SystemExit("parity test needs the local BDC photos; run it from the original research project")
    blobs = [open(p, "rb").read() for p in a["probe_path"]]
    z = np.array(Pilah().parity.remote(blobs))
    cos = (z * a["probe_z"]).sum(1)
    print("cosine to frozen z_final_v4:", np.round(cos, 4))
    assert (cos > 0.99).all(), "backend embedding does not reproduce the paper pipeline"
    print("parity ok")
