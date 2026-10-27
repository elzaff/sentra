// SENTRA (powered by CMRE): the working app.
// Photos go to the Modal backend (code/product/modal_pilah.py) for placement; sessions, items and photos stay on this
// device (IndexedDB) and are mirrored to Supabase: everyone can read, only the admin login can upload or change data.
// Officer confirmations and corrections are also sent to the backend for later evaluation.
// Two kinds of session share one model: setoran (one depositor, phone, gets a receipt) and batch (many photos, manifest).
(() => {
  "use strict";
  const API = new URLSearchParams(location.search).get("api") || "https://kwazawaja--cmre-pilah-pilah-web.us-east.modal.run";
  const PHOTO = new URLSearchParams(location.search).get("photo") || "https://kwazawaja--cmre-pilah-photo.us-east.modal.run";  // stored photos: GET /p/{pid} redirects to a short-lived signed URL
  const E = window.EWASTE, C = E.clusters;
  const CAT = { baterai: "Baterai", layar: "Layar dan monitor", besar: "Peralatan besar", kecil: "Peralatan kecil", ti: "TI dan telekomunikasi", komponen: "Komponen dan PCB" };
  const CHUNK = 8, SIDE = 768;
  const $ = s => document.querySelector(s), main = $("#appView"), researchPage = $("#researchPage"), researchContent = $("#researchContent"), dlg = $("#dlg");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d = 2) => Number(v).toFixed(d).replace(".", ",");
  const ico = n => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const day = t => new Date(t).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const clock = t => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const short = t => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + ", " + clock(t);
  const today = t => new Date(t).toDateString() === new Date().toDateString();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const coarse = matchMedia("(pointer: coarse)").matches;

  // ================= storage: IndexedDB, mirrored in memory =================
  const S = new Map(), I = new Map(), urls = new Map();
  const dbp = new Promise((res, rej) => {
    const r = indexedDB.open("cmre-pilah", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("sessions", { keyPath: "id" }); r.result.createObjectStore("items", { keyPath: "id" }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = (store, mode, fn) => dbp.then(db => new Promise((res, rej) => {
    const t = db.transaction(store, mode), q = fn(t.objectStore(store));
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error);
  }));
  const save = (store, v) => { cloud(store, v); return tx(store, "readwrite", s => s.put(v)).catch(e => toast("Gagal menyimpan: " + e.message)); };
  const drop = (store, k) => { cloud(store, { id: k }, true); return tx(store, "readwrite", s => s.delete(k)); };
  const putS = s => { S.set(s.id, s); return save("sessions", s); };
  const putI = it => { I.set(it.id, it); return save("items", it); };
  // local blob first (instant, offline); the stored copy in the bucket is the fallback when the blob is gone
  const imgURL = it => it.src || urls.get(it.id) || (it.img ? urls.set(it.id, URL.createObjectURL(it.img)).get(it.id) : it.pid ? `${PHOTO}/p/${it.pid}` : "");
  const itemsOf = sid => [...I.values()].filter(i => i.sid === sid).sort((a, b) => a.t - b.t);
  const cache = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  let UN = read("cmre-unit", {}), TY = read("erase-types", []);  // device cache; the cloud copy replaces it at start
  const unit = () => UN;
  const saveUnit = u => { UN = u; cache("cmre-unit", u); cloud("settings", { id: "unit", ...u }); };
  // new kinds found by the officer through "Kategori baru"
  const types = () => TY;
  const saveTypes = t => { TY.filter(x => !t.some(y => y.id === x.id)).forEach(x => cloud("types", x, true)); TY = t; cache("erase-types", t); t.forEach(x => cloud("types", x)); };
  const typeOf = id => types().find(t => t.id === id);

  // ================= cloud: Supabase. Public read; writes need the admin login (enforced by RLS and the Modal backend) =================
  const SB = "https://qshhmvuuqjuxullvston.supabase.co", SBK = "sb_publishable_fp8qYzvg3SfM8pWwr67TQQ_MY_ifJYe";  // the key is public by design
  const sbH = (tok, extra) => ({ apikey: SBK, ...(tok && { Authorization: "Bearer " + tok }), ...extra });
  let auth = null;
  try { auth = JSON.parse(localStorage.getItem("sentra-auth")); } catch {}
  const setAuth = a => {
    auth = a;
    try { a ? localStorage.setItem("sentra-auth", JSON.stringify(a)) : localStorage.removeItem("sentra-auth"); } catch {}
    document.querySelectorAll("[data-login]").forEach(b => { b.textContent = a ? "Keluar" : "Masuk"; });
  };
  setAuth(auth);
  async function grant(body) {
    const r = await fetch(`${SB}/auth/v1/token?grant_type=${body.password ? "password" : "refresh_token"}`, { method: "POST", headers: sbH(null, { "Content-Type": "application/json" }), body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(r.status === 400 ? "Username atau password salah." : j.msg || r.statusText);
    setAuth({ at: j.access_token, rt: j.refresh_token, exp: j.expires_at });
  }
  async function token() {  // null when signed out; refreshed a minute before it expires
    if (!auth) return null;
    if (auth.exp - 60 < Date.now() / 1000) { try { await grant({ refresh_token: auth.rt }); } catch { setAuth(null); return null; } }
    return auth.at;
  }
  const authH = async () => { const t = await token(); return t ? { Authorization: "Bearer " + t } : {}; };
  // Uji and demo sessions never leave the device
  const local = (store, v) => store === "sessions" ? v.type === "uji" || v.demo : S.get(v.sid)?.type === "uji" || S.get(v.sid)?.demo;
  async function cloud(store, v, del) {
    const t = await token();
    if (!t || (!del && (local(store, v) || (store === "items" && v.state !== "hasil")))) return;  // a failed write is retried at the next start (see pull)
    const { img, ...doc } = v;  // the photo blob stays on the device; the bucket holds the copy
    fetch(`${SB}/rest/v1/${store}` + (del ? `?id=eq.${encodeURIComponent(v.id)}` : "?on_conflict=id"), del
      ? { method: "DELETE", headers: sbH(t) }
      : { method: "POST", headers: sbH(t, { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify({ id: v.id, doc, updated_at: new Date().toISOString() }) }).catch(() => {});
  }
  // shortcut: cloud rows win over local ones and only the first 1000 rows load, upgrade to paging + updated_at compare if the data grows
  const pull = () => Promise.all(["sessions", "items", "types", "settings"].map(t => fetch(`${SB}/rest/v1/${t}?select=doc&limit=1000`, { headers: sbH(null), signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : Promise.reject()).then(r => r.map(x => x.doc)))).catch(() => null);
  const merge = (mine, theirs) => { const m = new Map(mine.map(x => [x.id, x])); theirs.forEach(d => m.set(d.id, { ...d, ...(m.get(d.id)?.img && { img: m.get(d.id).img }) })); return [...m.values()]; };

  let after = "#/";  // where to go once signed in
  function goLogin() { if (location.hash !== "#/masuk") after = location.hash || "#/"; location.hash = "#/masuk"; }
  function masuk() {
    if (auth) return location.replace("#/");
    main.innerHTML = `<div class="page auth"><div class="authcard">
      <img src="assets/mark.svg" alt="" width="44" height="44">
      <div><h1>Masuk</h1><p class="muted">Semua halaman bisa dilihat tanpa masuk. Masuk hanya untuk upload foto dan mengubah data.</p></div>
      <form class="login" novalidate>
        <label class="f">Username<input type="text" name="u" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></label>
        <label class="f">Password<input type="password" name="p" autocomplete="current-password" required></label>
        <p class="autherr" data-err role="alert" hidden></p>
        <button class="btn pri" type="submit">Masuk</button>
      </form>
      <a href="${esc(after)}" class="small">Lanjut tanpa masuk (hanya melihat)</a></div></div>`;
    const form = main.querySelector("form.login"), btn = form.querySelector("button"), err = form.querySelector("[data-err]");
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const u = form.elements.u.value.trim();
      if (!u || !form.elements.p.value) { err.textContent = "Isi username dan password."; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = "Memeriksa…"; err.hidden = true;
      try { await grant({ email: u.includes("@") ? u : u + "@sentrahub.tech", password: form.elements.p.value }); location.hash = after; location.reload(); }
      catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; btn.textContent = "Masuk"; }
    });
  }
  // UI gate: reading stays open, anything that uploads or edits asks for the login first (the real lock is server side)
  const MUT = "[data-new],[data-conf],[data-learn],[data-dconf],[data-dlearn],[data-ddel],[data-act=quick-cam],[data-act=quick-files],[data-act=cam],[data-act=files],[data-act=pick-dir],[data-act=unit],[data-act=discover],[data-act=not-ewaste],[data-act=learn-all],[data-act=retry],[data-act=bulk],[data-act=finish],[data-act=reopen]";
  const gate = sel => e => { if (auth || !e.target.closest(sel)) return; e.preventDefault(); e.stopPropagation(); goLogin(); };
  document.addEventListener("click", gate(MUT), true);
  document.addEventListener("change", gate("[data-dcorr],[data-dqty],[data-dkg]"), true);
  document.addEventListener("submit", gate("form.name"), true);
  document.addEventListener("drop", gate("[data-drop]"), true);
  document.addEventListener("click", e => { if (e.target.closest("[data-login]")) { if (auth) { setAuth(null); location.reload(); } else goLogin(); } });

  // ================= domain: which bin an item goes to =================
  const isRes = it => it.state === "hasil";
  const cl = it => C[typeof it.corr === "number" ? it.corr : it.res.cluster];
  const held = it => isRes(it) && it.res.ood && !it.conf;
  function route(it) {
    if (!isRes(it)) return null;
    if (it.corr === "bukan") return { key: "bukan", label: "Bukan e-waste", cls: "lain", b3: false };
    if (it.corr === "lain") return { key: "lain", label: "Cek manual", cls: "lain", b3: false };
    if (it.corr === "baru") { const t = typeOf(it.newType) || { name: "Kategori baru", b3: false };
      return { key: "baru-" + it.newType, label: (t.b3 ? "B3 · " : "Non-B3 · ") + t.name, cls: t.b3 ? "b3" : "", b3: t.b3 }; }
    if (held(it)) return { key: "tahan", label: "Perlu dicek", cls: "tahan", b3: false };
    const c = cl(it);
    return { key: c.cat + (c.b3 ? "-b3" : ""), label: (c.b3 ? "B3 · " : "Non-B3 · ") + CAT[c.cat], cls: c.b3 ? "b3" : "", b3: c.b3 };
  }
  const clusterRoute = c => ({ label: (c.b3 ? "B3 · " : "Non-B3 · ") + CAT[c.cat], cls: c.b3 ? "b3" : "" });
  const tag = (r, lg) => `<span class="tag ${r.cls}${lg ? " lg" : ""}">${esc(r.label)}</span>`;
  function status(it) {
    if (it.state === "proses") return ["", "memproses"];
    if (it.state === "gagal") return ["err", it.err ? "gagal: " + it.err : "gagal diproses"];
    if (it.conf === "benar") return ["ok", "dikonfirmasi petugas"];
    if (it.conf === "koreksi") return ["ok", "dikoreksi petugas"];
    if (it.res.ood) return ["cek", "perlu dicek"];
    return ["", "belum dikonfirmasi"];
  }
  const kindName = it => !isRes(it) ? "" : it.corr === "bukan" ? "Bukan e-waste" : it.corr === "lain" ? "Kategori lain"
    : it.corr === "baru" ? (typeOf(it.newType) || { name: "Kategori baru" }).name : cl(it).name;
  const qty = it => Math.max(1, it.qty || 1);
  const sName = s => s.label || `Pemilahan ${short(s.created)}`;
  const kindOfSession = s => s.type === "batch" ? "batch" : s.type === "uji" ? "uji metode" : "setoran";
  // held items from real work sessions that still carry their CMRE embedding can be regrouped into new kinds
  const pool = () => [...I.values()].filter(i => isRes(i) && i.res.z && !S.get(i.sid)?.demo && S.get(i.sid)?.type !== "uji"
    && (held(i) || i.corr === "lain")).sort((a, b) => a.t - b.t);
  // Kinds the officer named under "Kategori baru" are learned on this device: centre and reach of their CMRE embeddings.
  // A held photo close enough to one is offered as that kind. The 16 BDC clusters on the server never change.
  let learnt = null;  // cached per render
  const dist = (a, b) => Math.sqrt(a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0));
  function learned() {
    return learnt ??= types().map(t => {
      const zs = [...I.values()].filter(i => i.newType === t.id && i.res?.z).map(i => i.res.z);
      if (zs.length < 3) return null;  // too few photos for a stable centre
      const c = zs[0].map((_, j) => zs.reduce((s, z) => s + z[j], 0) / zs.length);
      return { t, c, r: 1.1 * Math.max(...zs.map(z => dist(z, c))) };
    }).filter(Boolean);
  }
  function suggest(it) {  // reach is at least the BDC OOD threshold, so a kind with tight members still catches new photos
    if (!(held(it) || (it.conf === "koreksi" && it.corr === "lain")) || !it.res?.z) return null;  // held, or filed as "not in the list"
    let best = null;
    for (const k of learned()) { const d = dist(it.res.z, k.c); if (d <= Math.max(k.r, it.res.threshold) && (!best || d < best.d)) best = { t: k.t, d }; }
    return best && best.t;
  }
  function toType(it, t) { it.newType = t.id; setConf(it, "koreksi", "baru"); learnt = null; }
  const typeTag = (t, lg) => tag({ label: (t.b3 ? "B3 · " : "Non-B3 · ") + t.name, cls: t.b3 ? "b3" : "" }, lg);
  function tally(list) {
    const res = list.filter(isRes);
    return { n: res.reduce((s, i) => s + qty(i), 0), b3: res.filter(i => route(i).b3).reduce((s, i) => s + qty(i), 0),
      held: res.filter(held).length, open: res.filter(i => !i.conf).length, run: list.filter(i => i.state === "proses").length,
      fail: list.filter(i => i.state === "gagal").length, kg: res.reduce((s, i) => s + (Number(i.kg) || 0), 0) };
  }
  function byRoute(list) {
    const g = new Map();
    list.filter(isRes).forEach(i => { const r = route(i), e = g.get(r.key) || { ...r, n: 0, kg: 0, kinds: new Set() };
      e.n += qty(i); e.kg += Number(i.kg) || 0; e.kinds.add(kindName(i)); g.set(r.key, e); });
    return [...g.values()].sort((a, b) => b.b3 - a.b3 || b.n - a.n);
  }
  const sumLine = t => `<p class="sum"><span><b>${t.n}</b>barang</span><span><b>${t.b3}</b>B3</span>${t.held ? `<span class="warn"><b>${t.held}</b>perlu dicek</span>` : ""}<span><b>${t.open}</b>belum dikonfirmasi</span></p>`;

  // ================= backend =================
  let online = false, pinging = null, tried = false;
  function srv(cls, text) { document.querySelectorAll("[data-srv]").forEach(e => { e.className = "srv " + cls; e.setAttribute("aria-label", text); e.title = text; e.lastElementChild.textContent = text; }); }
  function ping() {
    if (pinging) return pinging;
    tried = true;
    srv("wait", "Menyalakan AI…");
    pinging = fetch(API + "/health", { signal: AbortSignal.timeout(150000) }).then(r => r.ok).catch(() => false)
      .then(ok => { online = ok; pinging = null; srv(ok ? "on" : "off", ok ? "AI siap" : "AI offline"); return ok; });
    return pinging;
  }
  function feedback(it) {
    if (S.get(it.sid).demo || !online || !it.conf) return;
    token().then(t => t && fetch(`${SB}/rest/v1/feedback`, { method: "POST", headers: sbH(t, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ doc: { predicted: it.res.cluster, verdict: it.conf, corrected: it.conf === "koreksi" ? kindName(it) : "", score: it.res.score } }) })).catch(() => {});
  }

  // ---- photos: EXIF rotation applied, longest side 768 px (the pipeline drafts to 768 before resizing)
  async function prep(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, SIDE / Math.max(bmp.width, bmp.height));
    const cv = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise(res => cv.toBlob(res, "image/jpeg", 0.9));
  }

  const queue = [];
  let pumping = false;
  async function addFiles(sid, files, meta) {  // meta: optional [{ lab, source }] aligned with files (Uji metode)
    if (!auth) return goLogin();
    const keep = [...files].map((f, k) => [f, meta ? meta[k] : {}]).filter(([f]) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!keep.length) return;
    let bad = 0;
    for (const [f, m] of keep) {
      let img;
      try { img = await prep(f); } catch { bad++; continue; }
      const it = { id: uid(), sid, name: f.name, t: Date.now(), img, state: "proses", conf: "", corr: null, qty: 1, kg: null, ...m };
      await putI(it); queue.push(it.id);
    }
    if (bad) toast(`${bad} file tidak terbaca sebagai gambar.`);
    pump(); render();  // pump first so render sees the warm-up in progress
  }
  async function pump() {
    if (pumping) return;
    pumping = true;
    while (queue.length) {
      if (!online && !(await ping())) {
        queue.splice(0).forEach(id => { const it = I.get(id); if (it) { it.state = "gagal"; it.err = "server AI tidak terjangkau"; putI(it); } });
        toast("Server AI offline. Foto tetap tersimpan, tekan Proses ulang nanti.");
        break;
      }
      const part = queue.splice(0, CHUNK).map(id => I.get(id)).filter(Boolean);
      const fd = new FormData();
      part.forEach(it => { fd.append("files", it.img, it.name.replace(/\.\w+$/, "") + ".jpg"); fd.append("keep", S.get(it.sid)?.type === "uji" ? "0" : "1"); });  // Uji photos stay off the server
      try {
        const r = await fetch(API + "/predict", { method: "POST", headers: await authH(), body: fd, signal: AbortSignal.timeout(240000) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail || r.statusText);
        part.forEach((it, k) => { const { name, pid, ...res } = j.results[k]; it.res = res; it.pid = pid || it.pid || null; it.state = "hasil"; it.err = ""; putI(it); });
      } catch (e) {
        const why = e.name === "TimeoutError" ? "server AI terlalu lama" : e instanceof TypeError ? "server AI tidak terjangkau" : e.message;  // a TypeError from fetch is a network or CORS block
        part.forEach(it => { it.state = "gagal"; it.err = why; putI(it); });
        toast("Sebagian foto gagal diproses: " + why);
      }
      render();
    }
    pumping = false;
  }
  function retry(sid) {
    itemsOf(sid).filter(i => i.state === "gagal" && i.img).forEach(i => { i.state = "proses"; i.err = ""; putI(i); queue.push(i.id); });
    render(); pump();
  }
  function makeSession(type, label = "", place = "") {
    const n = Math.max(0, ...[...S.values()].filter(x => x.type === type && !x.demo).map(x => +(x.no.match(/\d+$/) || [0])[0])) + 1;
    const s = { id: uid(), no: ({ batch: "B-", uji: "U-" }[type] || "S-") + String(n).padStart(3, "0"), type, label, place, created: Date.now(), done: false };
    putS(s);
    return s;
  }
  function setConf(it, conf, corr = null) {
    it.conf = conf; it.corr = conf === "koreksi" ? corr : null;
    if (it.corr !== "baru") it.newType = null;  // a photo moved out of a learned kind must stop shaping its centre
    putI(it); feedback(it);
  }
  // learned kinds are listed too, so a slip in this dropdown can be undone and a photo can be filed into one by hand
  const corrOptions = sel => `<option value="">Koreksi kategori…</option>${C.map(c => `<option value="${c.id}" ${sel === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
    ${types().length ? `<optgroup label="Kategori baru">${types().map(t => `<option value="t:${t.id}" ${sel === "t:" + t.id ? "selected" : ""}>${esc(t.name)} (${t.b3 ? "B3" : "non-B3"})</option>`).join("")}</optgroup>` : ""}
    <option value="bukan" ${sel === "bukan" ? "selected" : ""}>Bukan e-waste</option><option value="lain" ${sel === "lain" ? "selected" : ""}>Kategori lain (tidak ada di daftar)</option>`;
  const parseCorr = v => v === "bukan" || v === "lain" ? v : Number(v);

  // ================= router =================
  let view = {}, filter = "semua";
  const picked = new Set();
  const researchMenu = document.querySelector("[data-nav-group]");
  researchMenu?.addEventListener("mouseenter", () => { researchMenu.open = true; });
  researchMenu?.addEventListener("mouseleave", () => { if (!researchMenu.contains(document.activeElement)) researchMenu.open = false; });
  researchMenu?.addEventListener("focusout", () => { if (!researchMenu.matches(":hover") && !researchMenu.contains(document.activeElement)) researchMenu.open = false; });
  function render() {
    learnt = null;
    const h = location.hash.replace(/^#\/?/, "").split("/");
    // in-dashboard anchors (#k17) stay inside the dashboard; app routes always start with "#/" (riset also has an id "uji")
    if (!location.hash.startsWith("#/") && h[0] && !researchPage.hidden && researchContent.shadowRoot?.getElementById(h[0])) return;
    const inResearch = h[0] === "riset";
    main.hidden = inResearch; researchPage.hidden = !inResearch;
    const nav = { riwayat: "riwayat", jenis: "jenis", baru: "baru", uji: "riset", riset: "riset", "": "home" }[h[0]] || "";
    document.querySelectorAll("[data-nav]").forEach(a => a.dataset.nav === nav ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    document.querySelectorAll("[data-riset-sub]").forEach(a => a.dataset.risetSub === (h[1] || "beranda") && h[0] === "riset" ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    if (h[0] === "s" && S.has(h[1])) {
      const s = S.get(h[1]);
      if (view.sid !== h[1]) { filter = "semua"; picked.clear(); }
      view = { sid: h[1] };
      return s.type === "uji" ? ujiView(s) : h[2] === "dokumen" ? docView(s) : workspace(s);
    }
    view = {};
    if (h[0] === "cara-kerja") return location.replace("#/riset/cara-kerja");  // old links: the walkthrough moved into the dashboard
    if (h[0] === "riset") return dashboard();
    return ({ riwayat: history, jenis: jenis, baru: jenisBaru, uji: ujiSetup, masuk: masuk }[h[0]] || home)();
  }

  // ================= views =================
  function row(it, ws) {
    const [k, txt] = status(it), r = route(it), s = S.get(it.sid);
    const pick = ws && s.type === "batch" && !s.done && isRes(it) && !it.conf && !it.res.ood;
    return `<div class="irow${picked.has(it.id) ? " sel" : ""}">
      <span class="ck">${pick ? `<input type="checkbox" data-pick="${it.id}" ${picked.has(it.id) ? "checked" : ""} aria-label="Pilih ${esc(it.name)}">` : ""}</span>
      <img src="${imgURL(it)}" alt="" loading="lazy" data-open="${it.id}">
      <div class="tx" data-open="${it.id}">${r ? tag(r) : `<span class="tt">${it.state === "proses" ? "Memproses…" : "Belum diproses"}</span>`}
        <span class="sub">${isRes(it) ? esc(kindName(it)) + " · " : ""}${it.lab ? "label " + esc(it.lab) + (it.source ? " (" + esc(it.source) + ")" : "") + " · " : ""}${esc(it.name)}${qty(it) > 1 ? " · " + qty(it) + " buah" : ""}${it.kg ? " · " + fmt(it.kg, 1) + " kg" : ""}</span></div>
      <span class="st ${k}">${it.state === "proses" ? '<span class="spin" role="img" aria-label="memproses"></span>' : it.conf || it.state === "gagal" ? txt : ""}</span>
      <span class="ra">${isRes(it) && !it.conf && !it.res.ood && !s.done ? `<button class="iconbtn" type="button" data-conf="${it.id}" aria-label="Benar: ${esc(it.name)}">${ico("check")}</button>` : ""}</span></div>`;
  }
  function srow(s) {
    const t = tally(itemsOf(s.id));
    return `<a class="srow" href="#/s/${s.id}"><span style="min-width:0"><span class="nm" style="display:block"><span class="dot${s.done ? " done" : ""}" aria-hidden="true"></span>${esc(sName(s))}</span>
      <span class="meta">${esc(s.no)} · ${kindOfSession(s)} · ${today(s.created) ? "hari ini " + clock(s.created) : short(s.created)}${s.done ? " · selesai" : ""}</span></span>
      <span class="r"><span><b>${t.n}</b> barang</span>${t.b3 ? `<span><b>${t.b3}</b> B3</span>` : ""}${t.held ? `<span><b>${t.held}</b> perlu dicek</span>` : ""}</span></a>`;
  }

  function home() {
    const ss = [...S.values()].sort((a, b) => b.created - a.created);
    const todayItems = [...I.values()].filter(i => today(i.t) && i.state !== "gagal").sort((a, b) => b.t - a.t);
    const demo = ss.find(s => s.demo);
    // one job on this screen: start sorting. Kategori baru and server status live in the navbar, Uji in the dashboard,
    // unit settings next to the receipts they print on
    main.innerHTML = `<div class="page">
      <section class="scan">
        <div class="capture" data-drop="home">
          <h1>Pilah e-waste cukup dari foto.</h1>
          <p>Upload foto barang, lalu lihat kategorinya dan apakah termasuk limbah B3. Satu barang per foto, bisa banyak foto sekaligus.</p>
          <div class="row">${!auth ? `<button class="btn pri big" type="button" data-act="login">Masuk untuk upload</button>`
            : (coarse ? `<button class="btn pri big" type="button" data-act="quick-cam">${ico("cam")}Ambil foto</button><button class="btn big" type="button" data-act="quick-files">${ico("img")}Upload foto</button>`
              : `<button class="btn pri big" type="button" data-act="quick-files">${ico("img")}Upload foto</button>`) + `<button class="btn big" type="button" data-new="setoran">${ico("doc")}Catat setoran warga</button>`}</div>
          <p class="small">${auth ? (coarse ? "" : "Bisa juga drag & drop foto ke sini. ") : "Kamu dalam mode lihat saja: semua halaman terbuka, tapi upload dan perubahan data butuh masuk. "}Belum punya foto? <button class="linkbtn" type="button" data-act="demo">${demo ? "Buka sesi demo" : "Coba demo dengan 12 foto"}</button></p>
        </div>
      </section>
      <section class="section"><div class="sechead"><h2>Hari ini</h2>${todayItems.length ? `<a href="#/riwayat">Riwayat</a>` : ""}</div>
        ${todayItems.length ? sumLine(tally(todayItems)) + `<div class="list">${todayItems.slice(0, 8).map(i => row(i)).join("")}</div>`
          : `<p class="empty">Belum ada barang hari ini.</p>`}</section>
      ${ss.length ? `<section class="section"><div class="sechead"><h2>Sesi terakhir</h2></div><div class="rows">${ss.slice(0, 5).map(srow).join("")}</div></section>` : ""}
    </div>`;
    if (online) srv("on", "AI siap"); else if (!pinging) srv(tried ? "off" : "idle", tried ? "AI offline" : "AI siaga");
  }

  function history() {
    const ss = [...S.values()].sort((a, b) => b.created - a.created), all = ss.flatMap(s => itemsOf(s.id)), g = byRoute(all), max = Math.max(1, ...g.map(r => r.n));
    main.innerHTML = `<div class="page">
      <div class="head"><div class="t"><h1>Riwayat</h1><p class="meta">${ss.length} sesi tersimpan.</p></div>
        <div class="acts"><button class="btn" type="button" data-act="unit">Atur unit & petugas</button><button class="btn" type="button" data-act="csv-all" ${all.length ? "" : "disabled"}>${ico("doc")}Unduh semua (CSV)</button></div></div>
      ${all.length ? sumLine(tally(all)) : ""}
      ${g.length ? `<section><div class="sechead"><h2>Per jalur</h2></div><div class="bars">${g.map(r => `<div class="bar-r">${tag(r)}<span class="tr"><i class="${r.cls}" style="width:${100 * r.n / max}%"></i></span><span class="n">${r.n}</span></div>`).join("")}</div></section>` : ""}
      <section class="section"><div class="sechead"><h2>Semua sesi</h2></div>${ss.length ? `<div class="rows">${ss.map(srow).join("")}</div>` : '<p class="empty">Belum ada sesi.</p>'}</section></div>`;
  }

  function workspace(s) {
    const its = itemsOf(s.id), t = tally(its), g = byRoute(its), batch = s.type === "batch";
    const inF = (i, f) => f === "semua" || (f === "tahan" ? held(i) : f === "belum" ? isRes(i) && !i.conf : f === "b3" ? isRes(i) && route(i).b3
      : f === "gagal" ? i.state === "gagal" : isRes(i) && "r:" + route(i).key === f);
    const F = [["semua", "Semua"], ["tahan", "Perlu dicek"], ["belum", "Belum dikonfirmasi"], ["b3", "B3"]];
    if (t.fail) F.push(["gagal", "Gagal diproses"]);
    const RF = g.filter(r => r.key !== "tahan").map(r => ["r:" + r.key, r.label]);
    if (![...F, ...RF].some(f => f[0] === filter)) filter = "semua";
    const shown = its.filter(i => inF(i, filter)).reverse();
    const last = !batch && !s.done && [...its].reverse().find(i => isRes(i) && !i.conf);
    const fbtn = ([k, l]) => `<button type="button" data-filter="${esc(k)}" aria-pressed="${filter === k}"><span>${esc(l)}</span><span class="num">${its.filter(i => inF(i, k)).length}</span></button>`;
    const open = shown.filter(i => isRes(i) && !i.conf && !i.res.ood);
    const adding = s.done || s.demo ? "" : batch
      ? `<div class="drop" data-drop="${s.id}">${ico("img")}<span>Drag foto ke sini. SENTRA mengirim ${CHUNK} foto per batch ke server.</span><span class="btns"><button class="btn pri sm" type="button" data-act="files">Tambah foto</button>${coarse ? `<button class="btn sm" type="button" data-act="cam">Kamera</button>` : ""}</span></div>`
      : `<div class="add"><button class="btn pri big" type="button" data-act="cam">${ico("cam")}Foto barang</button><button class="btn big" type="button" data-act="files">${ico("img")}Dari galeri</button></div>`;
    main.innerHTML = `<div class="page">
      <div class="head">
        <a class="iconbtn" href="#/" aria-label="Kembali">${ico("back")}</a>
        <div class="t"><h1>${esc(sName(s))}</h1>
          <p class="meta">${esc(s.no)} · ${batch ? "batch" : "setoran"} · ${day(s.created)}, ${clock(s.created)}${s.place ? " · " + esc(s.place) : ""}${s.demo ? " · sesi demo" : ""}</p></div>
        <div class="acts"><a class="btn" href="#/s/${s.id}/dokumen">${ico("doc")}${batch ? "Manifest" : "Tanda terima"}</a>
          <button class="btn${s.done ? "" : " pri"}" type="button" data-act="${s.done ? "reopen" : "finish"}">${s.done ? "Buka lagi" : "Selesai"}</button></div>
      </div>
      ${its.length ? sumLine(t) : ""}
      <div class="ws">
        <div class="filters" role="group" aria-label="Saring barang">${F.map(fbtn).join("")}${RF.length ? '<div class="cap">Per jalur</div>' + RF.map(fbtn).join("") : ""}</div>
        <div>
          ${adding}
          ${t.run ? `<p class="note"><span class="spin"></span>Memproses ${t.run} foto…${pinging ? " Server AI sedang menyala, foto pertama bisa butuh sekitar 1 menit." : ""}</p>` : ""}
          ${t.fail ? `<p class="note">${t.fail} foto belum diproses. <button class="btn sm" type="button" data-act="retry">Proses ulang</button></p>` : ""}
          ${last ? latest(last) : ""}
          ${batch && !s.done && open.length ? `<div class="bulk"><label><input type="checkbox" data-act="pickall" ${open.every(i => picked.has(i.id)) ? "checked" : ""}>Pilih ${open.length} hasil yang belum dikonfirmasi</label>
            <button class="btn sm" type="button" data-act="bulk" ${picked.size ? "" : "disabled"}>${ico("check")}Benarkan ${picked.size || ""}</button></div>` : ""}
          ${shown.length ? `<div class="list">${shown.map(i => row(i, true)).join("")}</div>`
            : `<p class="empty">${its.length ? "Tidak ada barang di saringan ini." : batch ? "Batch ini belum berisi foto." : "Foto barang pertama dari penyetor ini."}</p>`}
        </div>
      </div></div>`;
  }

  function latest(it) {
    const r = route(it), h = held(it), t = suggest(it);
    if (t) return `<div class="latest" aria-live="polite"><img src="${imgURL(it)}" alt="">
      <div style="min-width:0"><div class="to">Mirip kategori baru</div>${typeTag(t, true)}
        <div class="kind">${esc(t.name)}</div>
        <p>Foto ini di luar 16 kategori BDC, tapi dekat dengan barang yang sudah kamu namai ${esc(t.name)}.</p>
        <div class="acts"><button class="btn ok sm" type="button" data-learn="${it.id}">${ico("check")}Ya, ${esc(t.name)}</button><button class="btn sm" type="button" data-open="${it.id}">Periksa</button></div></div></div>`;
    return `<div class="latest" aria-live="polite"><img src="${imgURL(it)}" alt="">
      <div style="min-width:0"><div class="to">${h ? "Jangan masukkan dulu" : "Masukkan ke wadah"}</div>${tag(r, true)}
        <div class="kind">${esc(kindName(it))}${h ? " (paling mirip)" : ""}</div>
        <p>${h ? "Foto ini out-of-distribution (jauh dari semua foto BDC). Cek dulu sebelum dimasukkan." : esc(cl(it).handling)}</p>
        <div class="acts"><button class="btn ok sm" type="button" data-conf="${it.id}">${ico("check")}${h ? "Ya, kategorinya ini" : "Benar"}</button><button class="btn sm" type="button" data-open="${it.id}">${h ? "Periksa" : "Ubah"}</button></div></div></div>`;
  }

  function detail(it) {
    const s = S.get(it.sid), r = route(it), h = held(it), t = suggest(it);
    let body = `<p class="muted">${it.state === "proses" ? "Server AI sedang memproses foto ini." : "Foto ini belum diproses. Tutup, lalu tekan Proses ulang."}</p>`;
    if (isRes(it)) {
      const R = it.res, top = Math.max(R.threshold * 1.5, R.score * 1.1), maxD = Math.max(...R.centres.map(x => x[1]));
      const same = R.nbCluster.filter(x => x === R.cluster).length;
      body = `<div><div class="k">${h ? "Jangan masukkan dulu" : "Masukkan ke wadah"}</div>${tag(r, true)}</div>
        <div><div class="k">${h ? "Paling mirip" : it.conf === "koreksi" ? "Dikoreksi petugas" : "Kategori"}</div><div class="g">${esc(kindName(it))}</div>
          <p class="hand">${h ? "Foto ini out-of-distribution (jauh dari semua foto BDC). Konfirmasi kategorinya atau koreksi." : typeof it.corr === "string" ? "Catat kategorinya secara manual." : esc(cl(it).handling)}</p></div>
        ${t && !s.done ? `<div><div class="k">Mirip kategori baru</div>${typeTag(t, true)}
          <p class="hand">Dekat dengan barang yang sudah kamu namai ${esc(t.name)}.</p>
          <button class="btn ok" type="button" data-dlearn style="margin-top:10px">${ico("check")}Ya, ${esc(t.name)}</button></div>` : ""}
        ${s.done ? "" : `<div class="confirm"><button class="btn${t ? "" : " ok"}" type="button" data-dconf>${ico("check")}${h ? "Ya, kategorinya ini" : "Benar"}</button>
          <select data-dcorr aria-label="Koreksi kategori barang">${corrOptions(it.conf === "koreksi" ? (it.corr === "baru" ? "t:" + it.newType : it.corr) : null)}</select></div>
        <div class="fields"><label class="f">Jumlah<input type="number" min="1" step="1" value="${qty(it)}" data-dqty></label><label class="f">Berat (kg)<input type="number" min="0" step="0.1" value="${it.kg ?? ""}" data-dkg placeholder="opsional"></label></div>`}
        <details class="why"><summary>Kenapa kategori ini? ${same} dari 5 nearest neighbor ada di cluster yang sama</summary>
          <div class="ev"><h3>5 nearest neighbor dari data BDC</h3><p class="h">Angka di bawah foto: cosine similarity (1 = identik). Bingkai ungu: cluster yang sama.</p>
            <div class="nbg">${R.nb.map((id, k) => `<figure><img src="assets/t/${id}.webp" alt="" loading="lazy" class="${R.nbCluster[k] === R.cluster ? "same" : ""}" onerror="this.style.visibility='hidden'"><figcaption>${fmt(R.nbSim[k])}</figcaption></figure>`).join("")}</div></div>
          <div class="ev"><h3>Centroid terdekat</h3><p class="h">SENTRA memilih cluster dengan centroid terdekat.</p>
            ${R.centres.map(([k, d], j) => `<div class="cb${j ? "" : " win"}"><span class="t">${esc(C[k].name.replace(/ \(.*\)/, ""))}</span><span class="tr"><i style="width:${Math.max(6, 100 * d / maxD)}%"></i></span><span class="n">${fmt(d)}</span></div>`).join("")}</div>
          <div class="ev"><h3>OOD check</h3>
            <div class="gauge" style="--thr:${100 * R.threshold / top}%"><span class="th" style="left:${100 * R.threshold / top}%">threshold ${fmt(R.threshold)}</span><span class="mk" style="left:${Math.min(99, 100 * R.score / top)}%"></span></div>
            <div class="gl"><span>in-distribution</span><span>foto ini ${fmt(R.score)}</span><span>OOD</span></div></div>
        </details>`;
    }
    dlg.innerHTML = `<div class="dlg"><div class="top"><h2 id="dlgTitle">${esc(it.name)}</h2><button class="iconbtn" type="button" data-close aria-label="Tutup">${ico("x")}</button></div>
      <div class="det"><img class="ph" src="${imgURL(it)}" alt="Foto ${esc(it.name)}"><div class="col">${body}</div></div>
      <div class="acts">${s.done ? "" : '<button class="btn danger" type="button" data-ddel>Hapus</button>'}<button class="btn pri" type="button" data-close>Tutup</button></div></div>`;
    const q = sel => dlg.querySelector(sel);
    q("[data-dconf]")?.addEventListener("click", () => { setConf(it, "benar"); dlg.close(); render(); toast("Tersimpan."); });
    q("[data-dlearn]")?.addEventListener("click", () => { toType(it, t); dlg.close(); render(); toast(`Masuk ${t.name}.`); });
    q("[data-dcorr]")?.addEventListener("change", e => { const v = e.target.value; if (!v) return;
      const k = v.startsWith("t:") && typeOf(v.slice(2));
      k ? toType(it, k) : setConf(it, "koreksi", parseCorr(v)); learnt = null; detail(it); render(); });
    q("[data-dqty]")?.addEventListener("change", e => { it.qty = Math.max(1, Math.round(+e.target.value || 1)); putI(it); render(); });
    q("[data-dkg]")?.addEventListener("change", e => { it.kg = e.target.value === "" ? null : Math.max(0, +e.target.value); putI(it); render(); });
    q("[data-ddel]")?.addEventListener("click", () => { I.delete(it.id); drop("items", it.id); if (it.pid) authH().then(h => fetch(`${PHOTO}/p/${it.pid}`, { method: "DELETE", headers: h })).catch(() => {}); dlg.close(); render(); toast("Barang dihapus."); });
    if (!dlg.open) dlg.showModal();
  }

  function docView(s) {
    const its = itemsOf(s.id).filter(isRes), g = byRoute(its), t = tally(its), u = unit(), batch = s.type === "batch";
    main.innerHTML = `<div class="page">
      <div class="head noprint"><a class="iconbtn" href="#/s/${s.id}" aria-label="Kembali ke sesi">${ico("back")}</a><div class="t"><h1>${batch ? "Manifest" : "Tanda terima"}</h1></div>
        <div class="acts"><button class="btn" type="button" data-act="unit">Atur unit & petugas</button><button class="btn" type="button" data-act="csv">Unduh CSV</button><button class="btn pri" type="button" data-act="print">${ico("doc")}Cetak atau simpan PDF</button></div></div>
      <article class="doc">
        <div class="dh"><div><h1>${batch ? "Manifest Pemilahan E-Waste" : "Tanda Terima Setoran E-Waste"}</h1><p class="muted small" style="margin:4px 0 0">${esc(u.unit || "Nama unit belum diatur")}${u.officer ? " · petugas " + esc(u.officer) : ""}</p></div>
          <div class="small" style="text-align:right"><b>No. ${esc(s.no)}</b><br>${day(s.created)}, ${clock(s.created)}<br>${batch ? "Batch" : "Penyetor"}: ${esc(s.label || "-")}${s.place ? "<br>" + esc(s.place) : ""}</div></div>
        <h2>Rekap per jalur</h2>
        <div class="tw"><table><thead><tr><th>Jalur</th><th>Kategori</th><th class="n">Jumlah</th><th class="n">Berat (kg)</th></tr></thead><tbody>
          ${g.map(r => `<tr><td>${tag(r)}</td><td>${esc([...r.kinds].join(", "))}</td><td class="n">${r.n}</td><td class="n">${r.kg ? fmt(r.kg, 1) : "-"}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">Belum ada barang.</td></tr>'}
          <tr class="tot"><td colspan="2">Total</td><td class="n">${t.n}</td><td class="n">${t.kg ? fmt(t.kg, 1) : "-"}</td></tr></tbody></table></div>
        <h2>Rincian barang</h2>
        <div class="tw"><table><thead><tr><th class="n">#</th><th>Foto</th><th>Kategori</th><th>Jalur</th><th class="n">Jml</th><th>Status</th></tr></thead><tbody>
          ${its.map((i, k) => `<tr><td class="n">${k + 1}</td><td>${esc(i.name)}</td><td>${esc(kindName(i))}</td><td>${esc(route(i).label)}</td><td class="n">${qty(i)}</td><td>${status(i)[1]}</td></tr>`).join("")}</tbody></table></div>
        <p class="small muted" style="margin-top:14px">${t.held ? `${t.held} barang perlu dicek: sistem belum mengenalinya dan petugas belum memeriksanya. ` : ""}${t.open ? `${t.open} barang belum dikonfirmasi petugas. ` : ""}Barang jalur B3 diserahkan ke pengelola limbah B3 berizin. Dibuat dengan SENTRA (prototipe berbasis CMRE). Sistem menebak kategori, petugas mengonfirmasi.</p>
        ${batch ? "" : '<div class="sign"><div>Penyetor</div><div>Petugas</div></div>'}
      </article></div>`;
  }

  // ================= Panduan jenis: the 16 clusters grouped by bin =================
  const gallery = c => `assets/c${String(c.id).padStart(2, "0")}.jpg`;
  function jenis() {
    const jrow = c => `<button class="jrow" type="button" data-jenis="${c.id}"><img src="${gallery(c)}" alt="" loading="lazy">
      <span style="min-width:0"><span class="jt">${esc(c.name)}${c.id === 15 ? " · cluster campuran" : ""}</span><span class="jh" style="display:block">${esc(c.handling)}</span></span>
      <span class="jn">${tag(clusterRoute(c))}<br><span>${c.n} foto</span></span></button>`;
    const group = (title, list) => `<section class="jgroup"><div class="sechead"><h2>${title}</h2><span class="muted small">${list.length} kategori</span></div>${list.map(jrow).join("")}</section>`;
    main.innerHTML = `<div class="page">
      <div class="head"><div class="t"><h1>Kategori</h1><p class="meta">SENTRA mengenali 16 kategori. Kategori ini hasil clustering 3.792 foto BDC tanpa label; tim memberi nama sesudahnya. <a href="#/riset/k17">Peta 16 cluster dan alasan memilih K = 16 ada di dashboard riset.</a></p></div></div>
      ${group("Jalur B3", C.filter(c => c.b3))}${group("Jalur non-B3", C.filter(c => !c.b3))}
      <section class="jgroup"><div class="sechead"><h2>Kategori baru</h2><a href="#/baru">Cluster barang yang perlu dicek</a></div>
        ${types().length ? `<div class="rows">${types().map(t => `<div class="srow"><span>${tag({ label: (t.b3 ? "B3 · " : "Non-B3 · ") + t.name, cls: t.b3 ? "b3" : "" })}</span>
          <span class="r">${[...I.values()].filter(i => i.newType === t.id).length} barang · ditemukan ${short(t.created)}</span></div>`).join("")}</div>`
          : `<p class="empty">Belum ada. Barang yang tidak cocok dengan 16 kategori masuk status perlu dicek, lalu bisa di-cluster jadi kategori baru.</p>`}</section></div>`;
  }
  function jenisDialog(c) {
    dlg.innerHTML = `<div class="dlg"><div class="top"><h2 id="dlgTitle">${esc(c.name)}</h2><button class="iconbtn" type="button" data-close aria-label="Tutup">${ico("x")}</button></div>
      <img class="jgal" src="${gallery(c)}" alt="Contoh foto ${esc(c.name)}">
      <div>${tag(clusterRoute(c), true)}<p style="margin-top:10px">${esc(c.handling)}</p></div>
      ${c.id === 15 ? '<p class="small"><b>Cluster campuran.</b> Kategori ini memuat PCB dan foto tumpukan e-waste. Petugas memilah foto tumpukan secara manual.</p>' : ""}
      <p class="facts"><span><b>${c.n}</b> foto di data BDC</span><span>Jaccard stability <b>${fmt(c.jaccard)}</b> (stabil jika ≥ 0,85)</span><span>label purity <b>${Math.round(100 * c.top_share)}%</b></span></p>
      <div class="acts"><button class="btn pri" type="button" data-close>Tutup</button></div></div>`;
    dlg.showModal();
  }

  // ================= Dashboard riset: mount its native view once =================
  let researchLoad;
  const loadScript = src => new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement("script"), { src });
    script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
  });
  function dashboard() {
    if (researchLoad || researchContent.shadowRoot) return researchLoad;
    researchLoad = (async () => {
      const doc = new DOMParser().parseFromString(await fetch("riset.html").then(r => r.text()), "text/html");
      const root = researchContent.attachShadow({ mode: "open" });
      const style = document.createElement("style"); style.textContent = `:host { display:block; }\n${doc.querySelector("style").textContent.replace(":root {", ":host {")}\n.research { font:400 16px/1.55 var(--sans); color:var(--ink); -webkit-font-smoothing:antialiased; }`;
      const content = document.createElement("div"); content.className = "research";
      content.innerHTML = doc.querySelector("#dataError").outerHTML + doc.querySelector(".tip").outerHTML + doc.querySelector("main").innerHTML;
      root.append(style, content);
      if (!window.DEMO) await loadScript("demo.js?v=5");
      if (!window.GRAPH) await loadScript("graph.js?v=1");
      window.__researchRoot = root;
      try { await loadScript("riset.js?v=4"); } finally { delete window.__researchRoot; }
    })().catch(e => {
      const root = researchContent.shadowRoot;
      if (root) root.textContent = "Dashboard riset gagal dimuat: " + e.message;
      else researchContent.textContent = "Dashboard riset gagal dimuat: " + e.message;
      researchLoad = null;
    });
    return researchLoad;
  }

  // ================= Kategori baru: regroup held items into candidate new kinds (clustering, no labels) =================
  let found = null;  // last /discover answer, kept in memory: { k, silhouette, groups, ids }
  const thumb = it => `<img src="${imgURL(it)}" alt="" loading="lazy" data-open="${it.id}">`;
  function jenisBaru() {
    const all = pool(), ts = types(), demoHeld = [...I.values()].filter(i => held(i) && S.get(i.sid)?.demo).length;
    // photos that match a kind already named go to that kind; only the rest are clustered into new candidates
    const M = new Map(), P = all.filter(i => { const t = suggest(i); if (t) M.set(t.id, [...(M.get(t.id) || []), i]); return !t; });
    const matched = [...M].map(([id, its]) => { const t = typeOf(id);
      return `<section class="cand"><div class="sechead"><h2>${its.length} barang mirip ${esc(t.name)}</h2><button class="btn pri" type="button" data-act="learn-all" data-type="${id}">Masukkan ke ${esc(t.name)}</button></div>
        <p class="small muted">Dekat dengan barang yang sudah kamu namai ${esc(t.name)}, jadi tidak perlu di-cluster ulang.</p><div class="thumbs">${its.map(thumb).join("")}</div></section>`; }).join("");
    const grp = (g, k) => {
      const its = g.members.map(m => I.get(found.ids[m])).filter(Boolean);
      return `<section class="cand"><div class="sechead"><h2>Kandidat kategori ${String.fromCharCode(65 + k)} · ${its.length} barang</h2></div>
        <p class="small muted">Cohesion ${fmt(g.cohesion)} · centroid terdekat: ${esc(C[g.nearest].name)} (jarak ${fmt(g.nearestDist)})</p>
        <div class="thumbs">${its.map(thumb).join("")}</div>
        <form class="name" data-group="${k}"><input type="text" name="kind" maxlength="40" placeholder="Nama kategori, mis. Setrika" required aria-label="Nama kategori baru">
          <select name="bin" aria-label="Jalur"><option value="0">Jalur non-B3</option><option value="1">Jalur B3</option></select>
          <button class="btn pri" type="submit">Simpan kategori</button><button class="btn" type="button" data-act="not-ewaste" data-group="${k}">Bukan e-waste</button></form></section>`;
    };
    main.innerHTML = `<div class="page">
      <div class="head"><div class="t"><h1>Kategori baru</h1><p class="meta">Barang berstatus perlu dicek dari semua sesi. SENTRA melakukan clustering ulang tanpa label; kamu memberi nama dan memilih jalurnya.</p></div></div>
      ${ts.length ? `<p class="sum">${ts.map(t => tag({ label: (t.b3 ? "B3 · " : "Non-B3 · ") + t.name, cls: t.b3 ? "b3" : "" })).join("")}</p>` : ""}
      ${matched}
      ${found ? found.groups.map(grp).join("") + `<p class="small muted section">${found.k > 1 ? `Agglomerative clustering (cosine) pada embedding CMRE; K = ${found.k} dipilih otomatis lewat silhouette ${fmt(found.silhouette)}.` : "Barang ini belum membentuk cluster yang jelas, jadi tampil sebagai satu grup."}</p>`
        : P.length >= 4 ? `<div class="sechead"><h2>${P.length} barang perlu dicek</h2><button class="btn pri" type="button" data-act="discover">Cluster ${P.length} barang</button></div><div class="thumbs">${P.map(thumb).join("")}</div>`
        : `<p class="empty">Butuh minimal 4 barang berstatus perlu dicek; sekarang ada ${P.length}.${demoHeld ? " Barang dari sesi demo tidak ikut karena embedding-nya tidak tersimpan." : ""} Upload foto barang di luar 16 kategori, misalnya setrika atau kipas angin.</p>`}
    </div>`;
  }
  async function discover() {
    const P = pool().filter(i => !suggest(i)), btn = main.querySelector("[data-act=discover]");
    if (btn) { btn.disabled = true; btn.textContent = "Clustering…"; }
    try {
      const r = await fetch(PHOTO + "/discover", { method: "POST", headers: { "Content-Type": "application/json", ...await authH() }, body: JSON.stringify({ z: P.map(i => i.res.z) }), signal: AbortSignal.timeout(120000) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || r.statusText);
      found = { ...j, ids: P.map(i => i.id) };
    } catch (e) { toast("Clustering gagal: " + e.message); }
    render();
  }
  function applyGroup(k, corr, typeId) {
    found.groups[k].members.map(m => I.get(found.ids[m])).filter(Boolean)
      .forEach(it => { it.conf = "koreksi"; it.corr = corr; it.newType = typeId || null; putI(it); feedback(it); });
    found.groups.splice(k, 1);
    if (!found.groups.length) found = null;
    render();
  }

  // ================= Uji metode: the officer's (or jury's) own labelled folder, with vs without CMRE =================
  function ujiSetup() {
    main.innerHTML = `<div class="page article">
      <div class="head"><a class="iconbtn" href="#/riset" aria-label="Kembali ke dashboard riset">${ico("back")}</a><div class="t"><h1>Uji dengan dataset sendiri</h1>
        <p class="meta">Cek apakah foto barang sejenis dari dua sumber masuk cluster yang sama, dengan dan tanpa CMRE.</p></div></div>
      <ol class="pipe three">
        <li><i>1</i><b>Satu subfolder per label</b><span>Nama subfolder jadi label, mis. mouse, keyboard, baterai.</span></li>
        <li><i>2</i><b>Dua sumber (opsional)</b><span>Dua folder sumber, mis. katalog dan lapangan, dengan subfolder label yang sama.</span></li>
        <li><i>3</i><b>Pilih foldernya</b><span>SENTRA memproses semua foto. Label hanya dipakai untuk evaluasi.</span></li></ol>
      <pre class="tree">folder-uji/
  katalog/          sumber 1 (opsional)
    mouse/  keyboard/  baterai/
  lapangan/         sumber 2 (opsional)
    mouse/  keyboard/  baterai/</pre>
      <p class="add"><button class="btn pri big" type="button" data-act="pick-dir">${ico("img")}Pilih folder</button></p>
      <p class="small muted">Pemilihan folder butuh browser laptop (Chrome atau Edge). Foto tidak disimpan di server.</p></div>`;
  }
  function ujiView(s) {
    const its = itemsOf(s.id), res = its.filter(isRes), t = tally(its);
    const labs = [...new Set(res.map(i => i.lab).filter(Boolean))].sort(), srcs = [...new Set(res.map(i => i.source).filter(Boolean))].sort(), ref = srcs[0];
    const maj = (list, key) => { const c = {}; list.forEach(i => { c[i.res[key]] = (c[i.res[key]] || 0) + 1; }); return +Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
    // the paper's cross-source consistency: share of other-source photos in the reference source's majority cluster
    const cross = key => { let hit = 0, tot = 0; const per = {};
      labs.forEach(l => { const r = res.filter(i => i.lab === l && i.source === ref), o = res.filter(i => i.lab === l && i.source && i.source !== ref);
        if (!r.length || !o.length) return; const m = maj(r, key), h = o.filter(i => i.res[key] === m).length; hit += h; tot += o.length; per[l] = [h, o.length]; });
      return { v: tot ? hit / tot : null, per }; };
    const purity = key => { let hit = 0, tot = 0; const per = {};
      labs.forEach(l => { const r = res.filter(i => i.lab === l), m = maj(r, key), h = r.filter(i => i.res[key] === m).length; hit += h; tot += r.length; per[l] = [h, r.length, m]; });
      return { v: tot ? hit / tot : null, per }; };
    const ready = !t.run && labs.length;
    const xc = ready && srcs.length > 1 ? cross("cluster") : null, xr = ready && srcs.length > 1 ? cross("rawCluster") : null;
    const pc = ready ? purity("cluster") : null, pr = ready ? purity("rawCluster") : null;
    const pct = v => v == null ? "-" : Math.round(100 * v) + "%";
    const vs = (k, a, b) => `<div><p class="k">${k}</p><div class="vs"><span><b>${pct(a)}</b>tanpa CMRE</span><span class="win"><b>${pct(b)}</b>dengan CMRE</span></div></div>`;
    main.innerHTML = `<div class="page">
      <div class="head"><a class="iconbtn" href="#/uji" aria-label="Kembali">${ico("back")}</a><div class="t"><h1>Uji: ${esc(s.label)}</h1>
        <p class="meta">${esc(s.no)} · ${its.length} foto · ${labs.length} label${srcs.length ? " · " + srcs.length + " sumber" : ""} · ${day(s.created)}</p></div>
        <div class="acts"><button class="btn" type="button" data-act="csv">Unduh CSV</button></div></div>
      ${t.run ? `<p class="note"><span class="spin"></span>Memproses ${t.run} dari ${its.length} foto…</p>` : ""}
      ${t.fail ? `<p class="note">${t.fail} foto belum diproses. <button class="btn sm" type="button" data-act="retry">Proses ulang</button></p>` : ""}
      ${!t.run && res.length && !labs.length ? `<p class="empty">Foto tidak berada di subfolder label, jadi tidak ada label untuk evaluasi. Susun ulang foldernya.</p>` : ""}
      ${ready ? `<div class="verdictbox">${xc && xc.v != null ? vs(`Cross-source consistency: foto ${esc(srcs.slice(1).join(", "))} yang masuk cluster yang sama dengan foto ${esc(ref)} berlabel sama`, xr.v, xc.v) : ""}
          ${vs("Label purity: foto berlabel sama yang berkumpul di satu cluster", pr.v, pc.v)}</div>
        <section class="section"><div class="sechead"><h2>Per label</h2></div><div class="tw"><table class="mini"><thead><tr><th>Label</th><th class="n">Foto</th><th>Cluster terbanyak (CMRE)</th><th class="n">Purity</th>${xc ? '<th class="n">Cross-source tanpa CMRE</th><th class="n">Cross-source dengan CMRE</th>' : ""}<th class="n">Perlu dicek</th></tr></thead><tbody>
          ${labs.map(l => { const r = res.filter(i => i.lab === l), p = pc.per[l]; return `<tr><td>${esc(l)}</td><td class="n">${r.length}</td><td>${esc(C[p[2]].name)}</td><td class="n">${p[0]}/${p[1]}</td>
            ${xc ? `<td class="n">${xr.per[l] ? xr.per[l].join("/") : "-"}</td><td class="n">${xc.per[l] ? xc.per[l].join("/") : "-"}</td>` : ""}<td class="n">${r.filter(i => i.res.ood).length}</td></tr>`; }).join("")}</tbody></table></div>
          <p class="small muted">Tanpa CMRE: pipeline yang sama tanpa langkah erasure, ditempatkan ke 16 cluster yang sama.${xc ? ` Sumber referensi: ${esc(ref)}.` : ""} Satu label boleh terbagi ke beberapa cluster (mis. baterai: aki, baterai laptop, baterai ponsel).</p></section>` : ""}
      <section class="section"><div class="sechead"><h2>Semua foto</h2></div><div class="list">${[...its].reverse().map(i => row(i)).join("")}</div></section></div>`;
  }

  // ================= dialogs: setoran, unit =================
  function newSetoran() {
    dlg.innerHTML = `<form class="dlg"><div class="top"><h2 id="dlgTitle">Catat setoran warga</h2><button class="iconbtn" type="button" data-close aria-label="Tutup">${ico("x")}</button></div>
      <label class="f">Nama penyetor<input type="text" name="label" maxlength="60" autocomplete="off" placeholder="mis. Bu Ani, RT 03" required></label>
      <label class="f">Lokasi (opsional)<input type="text" name="place" maxlength="60" autocomplete="off"></label>
      <div class="acts"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Mulai memotret</button></div></form>`;
    const f = dlg.querySelector("form");
    f.addEventListener("submit", e => {
      e.preventDefault();
      const s = makeSession("setoran", f.label.value.trim(), f.place.value.trim());
      dlg.close(); location.hash = "#/s/" + s.id;
      if (coarse) $("#pickCam").click();  // same tap opens the camera on phones
    });
    dlg.showModal(); f.label.focus();
  }
  function unitDialog() {
    const u = unit();
    dlg.innerHTML = `<form class="dlg"><div class="top"><h2 id="dlgTitle">Nama unit</h2><button class="iconbtn" type="button" data-close aria-label="Tutup">${ico("x")}</button></div>
      <label class="f">Nama unit<input type="text" name="unit" maxlength="60" value="${esc(u.unit || "")}" placeholder="mis. Bank Sampah Bersinar"></label>
      <label class="f">Nama petugas<input type="text" name="officer" maxlength="60" value="${esc(u.officer || "")}"></label>
      <div class="acts"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Simpan</button></div></form>`;
    const f = dlg.querySelector("form");
    f.addEventListener("submit", e => { e.preventDefault(); saveUnit({ unit: f.unit.value.trim(), officer: f.officer.value.trim() }); dlg.close(); render(); });
    dlg.showModal();
  }

  // ---- demo session: stored results of the same pipeline for photos from other datasets (demo.js)
  function demo() {
    const ex = [...S.values()].find(s => s.demo);
    if (ex) { location.hash = "#/s/" + ex.id; return; }
    const go = () => {
      const D = window.DEMO, pick = st => D.cards.filter(c => c.status === st), clusterOf = new Map(D.pts.map(p => [p[6], p[4]]));
      const cards = [...pick("cocok").slice(0, 7), ...pick("lapangan").slice(0, 3), ...pick("alarm").slice(0, 2)];
      const s = { id: uid(), no: "B-000", type: "batch", label: "Sesi demo: foto dataset lain", place: "", created: Date.now(), done: false, demo: true };
      putS(s);
      cards.forEach((c, k) => putI({ id: uid(), sid: s.id, name: `${c.src}-${c.id}.webp`, t: Date.now() + k, src: `assets/c/${c.id}.webp`, state: "hasil", conf: "", corr: null, qty: 1, kg: null,
        res: { cluster: c.cluster, centres: c.centres, score: c.score, threshold: D.oodThreshold, ood: c.status === "alarm", nb: c.nb, nbSim: c.nbSim, nbCluster: c.nb.map(id => clusterOf.get(id)) } }));
      location.hash = "#/s/" + s.id;
    };
    if (window.DEMO) return go();
    const sc = Object.assign(document.createElement("script"), { src: "demo.js?v=9" });
    sc.onload = go; sc.onerror = () => toast("Data demo gagal dimuat."); document.body.appendChild(sc);
  }

  // ================= exports =================
  function csv(list, fname) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["sesi", "jenis_sesi", "tanggal", "penyetor_atau_batch", "file", "cluster", "jenis", "wadah", "b3", "ood", "skor_ood", "status", "jumlah", "berat_kg",
      "label_uji", "sumber_uji", "cluster_tanpa_cmre"];
    const body = list.filter(isRes).map(i => { const s = S.get(i.sid), r = route(i);
      return [s.no, s.type, new Date(s.created).toISOString().slice(0, 10), s.label, i.name, typeof i.corr === "string" ? "" : "C" + cl(i).id, kindName(i), r.label, r.b3 ? "ya" : "tidak",
        i.res.ood ? "ya" : "tidak", fmt(i.res.score, 3), status(i)[1], qty(i), i.kg ?? "", i.lab || "", i.source || "",
        i.res.rawCluster == null ? "" : "C" + i.res.rawCluster].map(q).join(","); });
    const url = URL.createObjectURL(new Blob(["﻿" + [head.join(","), ...body].join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: fname }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let tt;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 3500); }

  // ================= events (delegated) =================
  let quick = false;  // a session is made only once photos are chosen, so a cancelled picker leaves nothing behind
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-new],[data-act],[data-conf],[data-learn],[data-open],[data-filter],[data-close],[data-pick],[data-jenis]");
    if (!el) return;
    const s = view.sid && S.get(view.sid);
    if (el.dataset.new) return newSetoran();
    if (el.dataset.jenis) return jenisDialog(C[+el.dataset.jenis]);
    if (el.dataset.close !== undefined) return dlg.close();
    if (el.dataset.filter) { filter = el.dataset.filter; return render(); }
    if (el.dataset.pick) { el.checked ? picked.add(el.dataset.pick) : picked.delete(el.dataset.pick); return render(); }
    if (el.dataset.conf) { setConf(I.get(el.dataset.conf), "benar"); render(); return toast("Tersimpan."); }
    if (el.dataset.learn) { const it = I.get(el.dataset.learn), t = suggest(it); if (t) toType(it, t); render(); return toast(t ? `Masuk ${t.name}.` : "Tidak ada kategori yang cocok."); }
    if (el.dataset.open) return detail(I.get(el.dataset.open));
    const a = el.dataset.act;
    if (a === "quick-cam" || a === "quick-files") { quick = true; view = {}; $(a === "quick-cam" && coarse ? "#pickCam" : "#pickFiles").click(); }
    else if (a === "cam") $(coarse ? "#pickCam" : "#pickFiles").click();
    else if (a === "files") $("#pickFiles").click();
    else if (a === "pick-dir") $("#pickDir").click();
    else if (a === "login") goLogin();
    else if (a === "discover") discover();
    else if (a === "not-ewaste") { applyGroup(+el.dataset.group, "bukan"); toast("Ditandai bukan e-waste."); }
    else if (a === "learn-all") { const t = typeOf(el.dataset.type), its = pool().filter(i => suggest(i)?.id === t.id); its.forEach(i => toType(i, t)); render(); toast(`${its.length} barang masuk ${t.name}.`); }
    else if (a === "retry") retry(s.id);
    else if (a === "unit") unitDialog();
    else if (a === "demo") demo();
    else if (a === "print") print();
    else if (a === "csv") csv(itemsOf(s.id), `sentra-${s.no}.csv`);
    else if (a === "csv-all") csv([...I.values()].sort((x, y) => x.t - y.t), `sentra-riwayat-${new Date().toISOString().slice(0, 10)}.csv`);
    else if (a === "pickall") { const open = itemsOf(s.id).filter(i => isRes(i) && !i.conf && !i.res.ood && main.querySelector(`[data-pick="${i.id}"]`)); el.checked ? open.forEach(i => picked.add(i.id)) : picked.clear(); render(); }
    else if (a === "bulk") { const n = picked.size; picked.forEach(id => { const it = I.get(id); if (it && isRes(it) && !it.conf) setConf(it, "benar"); }); picked.clear(); render(); toast(`${n} barang dibenarkan.`); }
    else if (a === "finish") {
      const t = tally(itemsOf(s.id));
      if (t.run) return toast("Tunggu sampai semua foto selesai diproses.");
      if (t.held) { filter = "tahan"; render(); return toast(`${t.held} barang perlu dicek dulu.`); }
      s.done = true; s.closedAt = Date.now(); putS(s); location.hash = "#/s/" + s.id + "/dokumen";
    } else if (a === "reopen") { s.done = false; putS(s); render(); }
  });
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });  // tap on the backdrop closes
  ["#pickFiles", "#pickCam"].forEach(sel => $(sel).addEventListener("change", e => {
    const files = e.target.files;
    if (quick && files.length) {
      const s = makeSession(files.length > 1 ? "batch" : "setoran");
      view = { sid: s.id }; location.hash = "#/s/" + s.id;
    }
    quick = false;
    if (view.sid) addFiles(view.sid, files);
    e.target.value = "";
  }));
  // Uji metode: folder/<kind>/photo or folder/<source>/<kind>/photo; folder names become labels for scoring only
  $("#pickDir").addEventListener("change", e => {
    const fs = [...e.target.files].filter(f => /\.(jpe?g|png|webp)$/i.test(f.name));
    e.target.value = "";
    if (!fs.length) return toast("Folder itu tidak berisi foto JPG, PNG, atau WEBP.");
    const parts = f => (f.webkitRelativePath || f.name).split("/");
    const meta = fs.map(f => { const p = parts(f); return p.length >= 4 ? { source: p[1], lab: p[2] } : p.length === 3 ? { lab: p[1] } : {}; });
    const s = makeSession("uji", parts(fs[0])[0]);
    view = { sid: s.id }; location.hash = "#/s/" + s.id;
    addFiles(s.id, fs, meta);
  });
  // naming a candidate group turns it into a new kind on this device
  main.addEventListener("submit", e => {
    const f = e.target.closest("form.name");
    if (!f) return;
    e.preventDefault();
    const name = f.elements.kind.value.trim();
    if (!name) return;
    const b3 = f.elements.bin.value === "1";  // the same name on the same route adds to that kind instead of making a twin
    const t = types().find(x => x.name.toLowerCase() === name.toLowerCase() && x.b3 === b3) || { id: uid(), name, b3, created: Date.now() };
    if (!typeOf(t.id)) saveTypes([...types(), t]);
    applyGroup(+f.dataset.group, "baru", t.id);
    toast(`Kategori "${name}" tersimpan.`);
  });
  // drag and drop: on the home capture surface it starts a session; inside a batch it adds to it
  ["dragenter", "dragover"].forEach(t => main.addEventListener(t, e => { const z = e.target.closest("[data-drop]"); if (z) { e.preventDefault(); z.classList.add("over"); } }));
  ["dragleave", "drop"].forEach(t => main.addEventListener(t, e => { const z = e.target.closest("[data-drop]"); if (z) { e.preventDefault(); z.classList.remove("over"); } }));
  main.addEventListener("drop", e => {
    const z = e.target.closest("[data-drop]"); if (!z || !e.dataTransfer.files.length) return;
    const sid = z.dataset.drop === "home" ? makeSession(e.dataTransfer.files.length > 1 ? "batch" : "setoran").id : z.dataset.drop;
    if (z.dataset.drop === "home") { view = { sid }; location.hash = "#/s/" + sid; }
    addFiles(sid, e.dataTransfer.files);
  });
  addEventListener("hashchange", () => { if (dlg.open) dlg.close(); render(); if (!main.hidden) main.focus({ preventScroll: true }); scrollTo(0, 0); });

  async function refresh() {
    const r = await pull();
    if (!r) return;
    r[0].forEach(d => S.set(d.id, d));
    r[1].forEach(d => { const o = I.get(d.id); if (o?.state !== "proses") I.set(d.id, { ...d, ...(o?.img && { img: o.img }) }); });  // keep the local photo; leave running uploads alone
    TY = merge(TY, r[2]); cache("erase-types", TY);
    const cu = r[3].find(d => d.id === "unit"); if (cu) { UN = { unit: cu.unit, officer: cu.officer }; cache("cmre-unit", UN); }
    if (!dlg.open && !document.activeElement?.matches?.("input,select,textarea")) render();
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  // ================= start =================
  Promise.all([tx("sessions", "readonly", s => s.getAll()), tx("items", "readonly", s => s.getAll()), pull()]).then(([ss, its, remote]) => {
    let up = [];  // local rows the cloud lacks, pushed once S is filled (cloud() needs the session to skip Uji items)
    if (remote) {
      const have = new Set(remote.flat().map(d => d.id));
      up = [...ss.filter(v => !have.has(v.id)).map(v => ["sessions", v]), ...its.filter(v => !have.has(v.id)).map(v => ["items", v])];
      ss = merge(ss, remote[0]); its = merge(its, remote[1]);
      up.push(...TY.filter(v => !have.has(v.id)).map(v => ["types", v]));
      TY = merge(TY, remote[2]); cache("erase-types", TY);
      const cu = remote[3].find(d => d.id === "unit");
      if (cu) { UN = { unit: cu.unit, officer: cu.officer }; cache("cmre-unit", UN); }
      else if (UN.unit || UN.officer) up.push(["settings", { id: "unit", ...UN }]);
    }
    ss.forEach(s => S.set(s.id, s));
    its.forEach(i => { if (i.state === "proses") i.state = "gagal"; I.set(i.id, i); });  // uploads cut off by a reload can be retried
    up.forEach(([store, v]) => cloud(store, v));
    // one kind per name and route: merge twins saved before same-name kinds were reused
    const keep = new Map(), ts = types();
    ts.forEach(t => { const k = t.name.toLowerCase() + (t.b3 ? "|b3" : "");
      if (!keep.has(k)) keep.set(k, t); else I.forEach(i => { if (i.newType === t.id) { i.newType = keep.get(k).id; putI(i); } }); });
    if (keep.size < ts.length) saveTypes([...keep.values()]);
    render();
  }).catch(e => { main.innerHTML = `<div class="page"><p class="empty">Penyimpanan perangkat tidak tersedia (${esc(e.message)}). Buka di browser biasa, bukan mode privat.</p></div>`; });
  // no ping on load: the GPU backend wakes only when a photo is sent, since every wake-up costs Modal credit
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
