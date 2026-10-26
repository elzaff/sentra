# Backend SENTRA (Modal)

API yang dipanggil app untuk menempatkan foto e-waste ke salah satu dari 16 cluster (pipeline CMRE yang sama dengan paper).
Folder ini tidak ikut tersaji di website (lihat `.vercelignore` di root repo).

## Konfigurasi

| Yang diatur | Letak |
|---|---|
| Domain yang boleh memanggil API (CORS) | `ORIGINS` di `modal_pilah.py`, baris 25 |
| URL API yang dipanggil app | konstanta `API` di `app.js`, baris 7. Bisa ditimpa sementara lewat URL: `?api=https://...` |
| URL layanan foto yang dipanggil app | konstanta `PHOTO` di `app.js`, baris 8. Bisa ditimpa lewat URL: `?photo=https://...` |

Menambah domain baru: tambahkan ke `ORIGINS` (versi dengan dan tanpa `www` dihitung berbeda), lalu deploy ulang.
Selama belum di-deploy, app di domain itu menampilkan "AI offline".

## Penyimpanan foto (Biznet GIO Object Storage)

Foto sesi Setoran/Batch disimpan di bucket **privat** lewat API S3, dengan key acak `photos/<uuid4 hex>.jpg` yang dibuat
server (bukan input klien). Yang disimpan hanya piksel hasil re-encode JPEG (maks. 768 px), jadi EXIF/GPS tidak ikut.
Foto sesi "Uji" (`keep=0`) tidak disimpan. Kegagalan bucket tidak menggagalkan klasifikasi (`pid: null`).

- Unggah: `POST /predict` (form `keep` sejajar dengan `files`) mengembalikan `pid` per foto.
- Tampil: `GET {PHOTO}/p/{pid}` mengalihkan (302) ke presigned GET SigV4 berumur 15 menit. Layanan CPU terpisah, tidak menyalakan GPU.
- Hapus: `DELETE {PHOTO}/p/{pid}` (dipanggil saat petugas menghapus barang). `pid` 128-bit acak berfungsi sebagai kunci akses.
- Cek: `modal run backend/modal_pilah.py::storage_check` (put, GET bertanda tangan, GET tanpa tanda tangan harus 403, delete).

Modal Secret `BucketBiznnet` berisi `BIZNET_S3_ENDPOINT`, `BIZNET_S3_REGION`, `BIZNET_S3_BUCKET`, `BIZNET_S3_ACCESS_KEY`,
`BIZNET_S3_SECRET_KEY`. Disarankan juga mengatur aturan *lifecycle* kedaluwarsa pada prefix `photos/` di portal Biznet.
Browser memuat gambar langsung dari host bucket, jadi host itu harus dapat di-resolve oleh jaringan pengguna.

## Deploy

Butuh akses ke workspace Modal pemilik (undangan lewat modal.com), Modal Secret `huggingface-secret` berisi `HF_TOKEN`, dan
Secret `BucketBiznnet` (di atas). Token tidak pernah disimpan di repo.

```bash
MODAL_PROFILE=yaraxoaraal modal deploy backend/modal_pilah.py
```

Deploy tidak menyalakan GPU. GPU (satu L4) baru menyala saat foto dikirim dan mati sendiri setelah 3 menit tanpa request
(`scaledown_window=180`, `max_containers=1`).

## Endpoint

`GET /health`, `POST /predict` (foto), `POST /discover` (cluster ulang barang "perlu dicek"). Layanan foto: `GET /health`, `GET /p/{pid}`, `DELETE /p/{pid}`.

`artifacts.npz` berisi proyeksi CMRE, PCA-32, 16 centroid, dan threshold OOD hasil `build_artifacts.py` di repo riset utama.
