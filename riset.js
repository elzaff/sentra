(() => {
  const root = window.__researchRoot || document;
  const E = window.EWASTE, D = window.DEMO;
  if (!E || !D) { root.querySelector("#dataError").hidden = false; return; }
  const NS = "http://www.w3.org/2000/svg", $ = id => root.getElementById(id);
  const FOCUS = "#184e77", CONTEXT = "#93a3ab", INK = "#353241", TERRA = "#d0702a", LINE = "#d3e2cb";
  const fmt = (v, d = 3) => v == null ? "–" : v.toFixed(d).replace(".", ",");
  const pct = v => (Math.round(v * 1000) / 10).toString().replace(".", ",") + "%";
  const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const txt = (parent, x, y, s, attrs = {}) => { const t = el("text", { x, y, ...attrs }, parent); t.textContent = s; return t; };
  const hbarPath = (x, y, w, h, r = 4) => { r = Math.min(r, w, h / 2); return `M${x} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x}Z`; };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- shared tooltip: hover and keyboard focus show the same thing; every chart value is also in a table
  const tip = $("tip");
  const showTip = (html, x, y) => { tip.innerHTML = html; tip.classList.add("on");
    const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + "px"; tip.style.top = Math.max(8, y - h - 10) + "px"; };
  const hideTip = () => tip.classList.remove("on");
  const bindTip = (node, html) => {
    node.addEventListener("mousemove", e => showTip(html, e.clientX, e.clientY));
    node.addEventListener("mouseleave", hideTip);
    node.setAttribute("tabindex", "0");
    node.addEventListener("focus", () => { const b = node.getBoundingClientRect(); showTip(html, b.left + b.width * .6, b.top); });
    node.addEventListener("blur", hideTip);
  };
  const table = (host, head, rows, open = false) => {
    const isNum = c => typeof c === "number" || /^[\d,.%–-]+$/.test(c ?? "–");
    const cell = c => typeof c === "number" ? `<td class="r">${fmt(c)}</td>` : `<td class="${isNum(c) ? "r" : ""}">${c ?? "–"}</td>`;
    $(host).innerHTML = `<details class="tbl"${open ? " open" : ""}><summary>Lihat sebagai tabel</summary><div class="scroll"><table><thead><tr>${head.map((h, i) => `<th${i && isNum(rows[0] && rows[0][i]) ? ' class="r"' : ""}>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell).join("")}</tr>`).join("")}</tbody></table></div></details>`;
  };
  function hbars(svg, rows, { W, left, right = 56, top = 8, rowH = 30, barH = 16, max = 1, ticks = [0, .25, .5, .75, 1], tickFmt = v => fmt(v, 2), valueFmt = v => fmt(v, 3), dy = 0 } = {}) {
    const width = W - left - right, X = v => left + width * Math.min(v, max) / max;
    let y = top + dy; const placed = [];
    rows.forEach(() => { placed.push(y); y += rowH; });
    const bottom = y;
    ticks.forEach(t => { el("line", { x1: X(t), x2: X(t), y1: top + dy, y2: bottom, class: t ? "grid" : "base" }, svg); txt(svg, X(t), bottom + 18, tickFmt(t), { "text-anchor": "middle", class: "num" }); });
    rows.forEach((r, i) => {
      const y0 = placed[i], cy = y0 + rowH / 2, g = el("g", { class: "row" }, svg);
      el("rect", { x: 0, y: y0, width: W, height: rowH, class: "hit" }, g);
      txt(g, left - 10, cy + 4, r.label, { "text-anchor": "end", class: r.focus ? "strong" : "ink" });
      if (r.value != null && r.value > 0) el("path", { d: hbarPath(left, cy - barH / 2, Math.max(1, X(r.value) - left), barH), fill: r.color || (r.focus ? FOCUS : CONTEXT), class: "bar" }, g);
      txt(g, r.value == null ? left + 6 : X(r.value) + 6, cy + 4, valueFmt(r.value), { class: (r.focus ? "strong" : "ink") + " num" });
      bindTip(g, r.tip || `<b>${r.label}</b><br>${valueFmt(r.value)}`);
    });
    return bottom + 26;
  }
  function dots(svg, rows, { W, left, right = 60, top = 8, rowH = 32, min = 0, max = 1, ticks, tickFmt = v => fmt(v, 1), valueFmt = v => fmt(v, 3) } = {}) {
    const width = W - left - right, X = v => left + width * (Math.max(min, Math.min(v, max)) - min) / (max - min);
    const bottom = top + rows.length * rowH;
    ticks.forEach(t => { el("line", { x1: X(t), x2: X(t), y1: top, y2: bottom, class: t === min ? "base" : "grid" }, svg); txt(svg, X(t), bottom + 18, tickFmt(t), { "text-anchor": "middle", class: "num" }); });
    rows.forEach((r, i) => {
      const cy = top + i * rowH + rowH / 2, g = el("g", { class: "row" }, svg);
      el("rect", { x: 0, y: cy - rowH / 2, width: W, height: rowH, class: "hit" }, g);
      el("line", { x1: X(min), x2: X(max), y1: cy, y2: cy, stroke: LINE, "stroke-width": 1 }, g);
      txt(g, left - 10, cy + 4, r.label, { "text-anchor": "end", class: r.focus ? "strong" : "ink" });
      if (r.ci) { el("line", { x1: X(r.ci[0]), x2: X(r.ci[1]), y1: cy, y2: cy, stroke: INK, "stroke-width": 1.5 }, g);
                  r.ci.forEach(c => el("line", { x1: X(c), x2: X(c), y1: cy - 5, y2: cy + 5, stroke: INK, "stroke-width": 1.5 }, g)); }
      if (r.value != null) el("circle", { cx: X(r.value), cy, r: r.focus ? 6 : 5, fill: r.focus ? FOCUS : CONTEXT }, g);
      txt(g, r.value == null ? left + 6 : Math.max(X(r.value), r.ci ? X(r.ci[1]) : 0) + 10, cy + 4, valueFmt(r.value), { class: (r.focus ? "strong" : "ink") + " num" });
      bindTip(g, r.tip || `<b>${r.label}</b><br>${valueFmt(r.value)}`);
    });
    return bottom + 26;
  }
  const fit = (svg, W, H) => svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const bdc = E.datasets.find(d => d.id === "bdc"), oh = E.datasets.find(d => d.id === "oh"), shubha = E.datasets.find(d => d.id === "shubha");

  // six handling categories: four cool hues from the owner palette (navy, blue, teal, light green) plus mustard and terracotta.
  // Terracotta doubles as "needs attention" (components, the K = 17 split, low stability), which is why components carry it.
  const CATNAME = { baterai: "Baterai", layar: "Layar dan monitor", besar: "Peralatan besar", kecil: "Peralatan kecil", ti: "TI dan telekomunikasi kecil", komponen: "Komponen" };
  const CATCOLORS = { baterai: "#184e77", layar: "#168aad", besar: "#e0b13a", kecil: "#99d98c", ti: "#52b69a", komponen: TERRA };
  // one hue per photo source; Bangladesh carries the warm accent because it is the source CMRE has to pull back in
  const SRCCOL = { bdc: "#c4d3cc", kaan: "#1a759f", bangla: TERRA, karan: "#e0b13a", giz: "#52b69a" };
  const C = E.clusters;
  const LABEL = { battery: "Baterai", keyboard: "Keyboard", mobile: "Ponsel", mouse: "Mouse", pcb: "PCB", microwave: "Microwave", player: "Pemutar audio", printer: "Printer", television: "Televisi", washing_machine: "Mesin cuci", light_bulb: "Lampu" };
  const SRCNAME = { bdc: "BDC", bdc_test: "BDC (test set)", kaan: "Kaan · foto katalog", bangla: "Bangladesh · foto objek", karan: "Karan · foto baterai", giz: "GIZ · foto lapangan" };
  const SRCSHORT = { kaan: "Kaan", bangla: "Bangladesh", karan: "Karan", giz: "GIZ" };
  const STATUS = { cocok: "Sesuai label dataset", meleset: "Tidak sesuai label", alarm: "OOD: perlu dicek", lapangan: "Foto lapangan tanpa label" };
  const cardLabel = c => c.src === "karan" ? "Baterai" : c.src === "giz" ? "Foto lapangan" : (LABEL[c.label] || c.label);
  const KNOWN = new Set(Object.values(D.majority));
  const thumb = id => `assets/t/${id}.webp`, big = id => `assets/c/${id}.webp`;
  const imgTag = (src, alt, cls = "") => `<img src="${src}" alt="${alt}" loading="lazy" class="${cls}" onerror="this.style.visibility='hidden'">`;
  const short = c => C[c].name.replace(/ \(.*\)/, "");

  // ---- before/after control: drag the slider, jump to either end, or play and pause; onT(t, final) redraws
  function morphControl(host, onT, { left = "Sebelum CMRE", right = "Sesudah CMRE", start = 1, ms = 3000 } = {}) {
    host.innerHTML = `<button class="btn play" type="button">Putar</button><button class="end" type="button" data-to="0">${left}</button>
      <input type="range" min="0" max="1000" step="1" value="${start * 1000}" aria-label="Geser dari ${left} ke ${right}"><button class="end" type="button" data-to="1">${right}</button>`;
    const play = host.querySelector(".play"), range = host.querySelector("input"), ends = host.querySelectorAll(".end");
    let t = start, raf = null;
    const set = (v, final) => { t = Math.max(0, Math.min(1, v)); range.value = Math.round(t * 1000);
      ends.forEach(b => b.classList.toggle("on", (t === 0 && b.dataset.to === "0") || (t === 1 && b.dataset.to === "1")));
      onT(t, final); };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; play.textContent = t >= 1 ? "Putar ulang" : "Putar"; };
    const run = () => {
      if (raf) { stop(); return; }
      if (t >= 1) set(0, false);
      if (reduced) { set(1, true); stop(); return; }
      const t0 = performance.now() - t * ms; play.textContent = "Jeda";
      const tick = now => { const k = Math.min(1, (now - t0) / ms); set(k, k >= 1); if (k < 1) raf = requestAnimationFrame(tick); else { raf = null; stop(); } };
      raf = requestAnimationFrame(tick);
    };
    play.onclick = run;
    range.oninput = () => { stop(); set(range.value / 1000, false); };
    range.onchange = () => set(range.value / 1000, true);
    ends.forEach(b => b.onclick = () => { stop(); set(+b.dataset.to, true); });
    set(start, true); stop();
    return { set: (v, f = true) => { stop(); set(v, f); stop(); }, stop, get t() { return t; } };
  }

  // ================= PETA =================
  const idx = new Map(D.pts.map((p, i) => [p[6], i]));
  const MX = v => 20 + v * .96, MY = v => 16 + v * .528, MAP_H = 560;
  const dmap = $("dmap"), layer = el("g", {}, dmap), hl = el("g", {}, dmap);
  let T = 1, current = null, pendingFly = null, lastRaw = false;
  const isRaw = () => T < .5;
  const marks = D.pts.map(p => {
    const ext = p[5] >= 2, col = CATCOLORS[C[p[4]].cat];
    const m = el("circle", { class: "p" + (ext ? " e" : ""), r: ext ? 3.6 : 2.4, cx: 0, cy: 0 });
    if (ext) m.setAttribute("stroke", col); else { m.setAttribute("fill", col); m.setAttribute("fill-opacity", .8); }
    m.dataset.i = p[6];
    return m;
  });
  marks.forEach((m, i) => { if (D.pts[i][5] < 2) layer.appendChild(m); });
  marks.forEach((m, i) => { if (D.pts[i][5] >= 2) layer.appendChild(m); });
  const pos = i => { const p = D.pts[i]; return [MX(p[0] + (p[2] - p[0]) * T), MY(p[1] + (p[3] - p[1]) * T)]; };
  const place = () => marks.forEach((m, i) => { const [x, y] = pos(i); m.style.transform = `translate(${x}px,${y}px)`; });
  const paintMap = mode => {
    $("mapColor").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === mode));
    marks.forEach((m, i) => { const p = D.pts[i], ext = p[5] >= 2;
      if (mode === "src") { m.style.fill = ext ? SRCCOL[D.src[p[5]]] : SRCCOL.bdc; m.style.stroke = ext ? "#fff" : "none"; m.style.fillOpacity = ext ? 1 : .75; }
      else { m.style.fill = m.style.stroke = m.style.fillOpacity = ""; } });
    $("legend").innerHTML = mode === "src"
      ? [["bdc", "foto BDC"], ["kaan", "Kaan · katalog"], ["bangla", "Bangladesh · objek"], ["karan", "Karan · baterai"], ["giz", "GIZ · lapangan"]].map(([k, l]) => `<span><i class="sw" style="background:${SRCCOL[k]}"></i>${l}</span>`).join("")
      : Object.entries(CATCOLORS).map(([k, c]) => `<span><i class="sw" style="background:${c}"></i>${CATNAME[k]}</span>`).join("") + `<span><i class="sw ring"></i>foto dataset lain</span>`;
  };
  $("mapColor").querySelectorAll("button").forEach(b => b.onclick = () => paintMap(b.dataset.mode));
  paintMap("cat");
  // how many of the 10 nearest map neighbours of a Bangladesh photo are other external photos; computed, not asserted
  const bangla = D.pts.filter(p => D.src[p[5]] === "bangla");
  const clump = o => Math.round(100 * bangla.reduce((s, p) => s + D.pts.map(q => [(q[o] - p[o]) ** 2 + (q[o + 1] - p[o + 1]) ** 2, q[5] >= 2])
    .sort((a, b) => a[0] - b[0]).slice(1, 11).filter(x => x[1]).length / 10, 0) / bangla.length);
  const clumpRaw = clump(0), clumpCmre = clump(2);
  const setNote = () => $("mapnote").textContent = T === 0
    ? `Sebelum CMRE: foto objek Bangladesh (background hijau) menggerombol sendiri. Dari 10 nearest neighbor-nya di peta, rata-rata ${clumpRaw} persen sesama foto dataset lain. Cross-source consistency ${fmt(bdc.raw, 3)}.`
    : T === 1 ? `Sesudah CMRE: angka itu turun ke ${clumpCmre} persen, jadi lebih banyak foto dataset lain bertetangga dengan foto BDC. Cross-source consistency ${fmt(bdc.cmre, 3)}.`
    : "Peralihan antara peta sebelum dan sesudah CMRE. Tekan Jeda atau lepaskan slider untuk berhenti di titik ini.";
  dmap.addEventListener("mousemove", e => {
    const i = e.target.dataset && e.target.dataset.i; if (i == null) return;
    const p = D.pts[idx.get(+i)], cl = C[p[4]];
    showTip(`${p[7] ? `<img src="${thumb(p[6])}" alt="">` : ""}<b>C${cl.id} · ${cl.name}</b><br>${SRCNAME[D.src[p[5]]]}`, e.clientX, e.clientY);
  });
  dmap.addEventListener("mouseleave", hideTip);

  function mark(card) {
    hl.innerHTML = ""; dmap.classList.add("dim");
    const [x, y] = pos(idx.get(card.id));
    (isRaw() ? card.nbRaw : card.nb).forEach(id => {
      const [nx, ny] = pos(idx.get(id));
      el("line", { x1: x, y1: y, x2: nx, y2: ny, class: "nbline" }, hl);
      el("circle", { cx: nx, cy: ny, r: 5, class: "nbring" }, hl);
    });
    el("circle", { cx: x, cy: y, r: 9, class: "pulse" }, hl);
    el("circle", { cx: x, cy: y, r: 6, class: "me" }, hl);
  }

  // ---- explanation panel: the decision rule (nearest group centre), the visual evidence, and the alarm check
  const APP = `<p class="applabel"><span>Tampilan untuk petugas</span><span>prototipe</span></p>`;
  function renderResult(host, card) {
    if (!card) { host.innerHTML = APP + `<div class="result-empty"><div class="ring" aria-hidden="true"></div><h3>Belum ada foto dipilih</h3><p>${host.id === "panel" ? "Pilih salah satu kartu foto di bawah peta. Fotonya akan masuk ke peta, lalu hasil dan tiga alasannya muncul di sini." : "Pilih foto di galeri untuk melihat cluster-nya dan tiga alasan di baliknya."}</p></div>`; return; }
    const cl = C[card.cluster], raw = host.id === "panel" && isRaw();
    const label = card.src === "giz" ? "tanpa label" : `label dataset: ${cardLabel(card).toLowerCase()}`;
    let body;
    if (raw) {
      const nbHtml = card.nbRaw.map(id => { const p = D.pts[idx.get(id)]; return `<figure>${imgTag(thumb(id), "")}<figcaption>C${p[4]}</figcaption></figure>`; }).join("");
      body = `<div class="verdict"><div class="cn">Sebelum CMRE</div><p style="margin:4px 0 0">Lima foto BDC terdekatnya berasal dari ${[...new Set(card.nbRaw.map(id => "C" + D.pts[idx.get(id)][4]))].join(", ")}. Geser ke "Sesudah CMRE" untuk melihat hasil akhir dan alasannya.</p></div>
        <div class="nbgrid">${nbHtml}</div>`;
    } else {
      const alarm = card.status === "alarm", maxD = Math.max(...card.centres.map(c => c[1]));
      const same = card.nb.filter(id => D.pts[idx.get(id)][4] === card.cluster).length;
      const centresHtml = card.centres.map(([c, d], i) => `<div class="cbar${i ? "" : " win"}"><span class="t">C${c} · ${short(c)}</span><span class="tr"><i style="width:${Math.max(6, 100 * d / maxD)}%"></i></span><span class="num">${fmt(d, 2)}</span></div>`).join("");
      const nbHtml = card.nb.map((id, i) => { const p = D.pts[idx.get(id)]; return `<figure>${imgTag(thumb(id), "", p[4] === card.cluster ? "same" : "")}<figcaption>C${p[4]}<br>${fmt(card.nbSim[i], 2)}</figcaption></figure>`; }).join("");
      const thr = D.oodThreshold, top = Math.max(thr * 1.5, card.score * 1.1);
      const unknown = card.label && !KNOWN.has(card.label);
      body = `<div class="verdict${alarm ? " alarm" : ""}"><div class="cn">${alarm ? "Cluster terdekat, tetapi barang ini belum dikenal" : "Masuk cluster"}</div><div class="gname">C${cl.id} · ${cl.name}</div>
          <div class="chips"><span class="chip ${card.status}">${STATUS[card.status]}</span>${cl.b3 ? '<span class="chip b3">mengandung B3</span>' : ""}</div></div>
        <p class="why-h">Kenapa hasilnya begini?</p>
        <div class="ev"><div class="evh"><span class="k">1</span>Centroid paling dekat</div>
          <p class="evs">Sistem membandingkan foto ini dengan centroid 16 cluster. Centroid dengan jarak terpendek menentukan cluster-nya.</p>
          <div class="body">${centresHtml}</div></div>
        <div class="ev"><div class="evh"><span class="k">2</span>Foto BDC yang paling mirip</div>
          <p class="evs">${same} dari 5 foto termirip juga ada di C${cl.id} (berbingkai biru tua). Angka di bawah foto = cosine similarity; 1 berarti sama persis.</p>
          <div class="body nbgrid">${nbHtml}</div></div>
        <div class="ev"><div class="evh"><span class="k">3</span>Cek OOD: apakah barang ini dikenal?</div>
          <p class="evs">${alarm ? "Jarak ke nearest neighbor BDC ke-10 melewati threshold, jadi sistem meminta petugas memeriksa." : "Jarak ke nearest neighbor BDC ke-10 masih di bawah threshold, jadi barang ini mirip barang yang sudah dikenal."}${unknown ? ` ${cardLabel(card)} memang tidak ada di data BDC.` : ""}</p>
          <div class="body"><div class="gauge" style="--thr:${100 * thr / top}%"><span class="th" style="left:${100 * thr / top}%">threshold ${fmt(thr, 2)}</span><span class="mk" style="left:${Math.min(99, 100 * card.score / top)}%"></span></div>
            <div class="gauge-l"><span>dikenal</span><span>foto ini: ${fmt(card.score, 2)}</span><span>asing</span></div></div></div>
        ${alarm ? "" : `<div class="ev"><div class="evh">Saran penanganan</div><p class="handling" style="margin:6px 0 0">${cl.handling}</p></div>`}`;
    }
    host.innerHTML = APP + `<figure class="photo">${imgTag(big(card.id), cardLabel(card))}</figure>
      <p class="kicker" style="margin:0;color:var(--muted)">${SRCNAME[card.src]} · ${label}</p>${body}
      ${host.id === "cobaPanel" ? `<p style="margin-top:12px"><a class="btn" href="#stage" data-show="1">Tampilkan di peta</a></p>` : ""}`;
    const show = host.querySelector("[data-show]"); if (show) show.onclick = () => { pendingFly = card; };
  }

  const mapMorph = morphControl($("mapMorph"), (t, final) => {
    T = t; dmap.classList.toggle("scrub", !final || reduced); place(); setNote();
    if (current) { mark(current); if (isRaw() !== lastRaw) { lastRaw = isRaw(); renderResult($("panel"), current); } }
  });

  function fly(card, from) {
    current = card; hideTip(); lastRaw = isRaw();
    $("tray").querySelectorAll(".pcard").forEach(b => b.setAttribute("aria-pressed", +b.dataset.id === card.id));
    const finish = () => { mark(card); renderResult($("panel"), card); };
    if (reduced || !from) { finish(); return; }
    // the photo must travel to a point the viewer can see: bring the map into view first when it is scrolled off
    const s0 = dmap.getBoundingClientRect(), off = s0.top < 80 ? s0.top - 80 : s0.bottom > innerHeight ? s0.bottom - innerHeight + 12 : 0;
    if (off) scrollBy({ top: off, behavior: "smooth" });
    setTimeout(() => {
      const r = from.getBoundingClientRect(), s = dmap.getBoundingClientRect(), [px, py] = pos(idx.get(card.id));
      const tx = s.left + px * s.width / 1000, ty = s.top + py * s.height / MAP_H;
      const g = document.createElement("img"); g.className = "ghost"; g.src = big(card.id); g.alt = "";
      Object.assign(g.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.width + "px" });
      (root.querySelector(".research") || document.body).appendChild(g);
      requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(g.style, { left: tx - 9 + "px", top: ty - 9 + "px", width: "18px", height: "18px", borderRadius: "50%", opacity: ".5" })));
      setTimeout(() => { g.remove(); finish(); }, 740);
    }, off ? 380 : 0);
  }

  const pcard = c => `<button class="pcard" type="button" data-id="${c.id}" aria-pressed="false" aria-label="${cardLabel(c)}, ${SRCNAME[c.src]}">${imgTag(big(c.id), "")}<span class="t">${cardLabel(c)}</span><span class="s">${SRCSHORT[c.src]}</span></button>`;
  const byStatus = s => D.cards.filter(c => c.status === s);
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
  const pick = (arr, n, seen) => { const out = [];
    for (const c of shuffle(arr)) { if (out.length === n) break; const key = c.src + c.label; if (seen.has(key)) continue; out.push(c); seen.add(key); } return out; };
  function drawTray() {
    const seen = new Set();
    const six = [...pick(byStatus("cocok"), 3, seen), ...pick(byStatus("meleset"), 1, seen), ...pick(byStatus("alarm"), 1, seen), ...pick(byStatus("lapangan"), 1, seen)];
    for (const c of shuffle(D.cards)) { if (six.length >= 6) break; if (!six.includes(c)) six.push(c); }
    $("tray").innerHTML = shuffle(six).map(pcard).join("");
    $("tray").querySelectorAll(".pcard").forEach(b => b.onclick = () => fly(D.cards.find(c => c.id === +b.dataset.id), b));
  }
  $("shuffle").onclick = drawTray;
  drawTray();
  renderResult($("panel"), null);

  // ================= COBA SENDIRI =================
  let fSrc = "semua", fRes = "semua";
  const segBtns = (host, opts, get, set) => opts.forEach(([k, l]) => {
    const b = document.createElement("button"); b.className = "btn"; b.type = "button"; b.textContent = l; b.dataset.k = k;
    b.setAttribute("aria-pressed", k === get());
    b.onclick = () => { set(k); $(host).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x.dataset.k === k)); drawGallery(); };
    $(host).appendChild(b); });
  const nStat = s => D.cards.filter(c => c.status === s).length;
  segBtns("fSrc", [["semua", "Semua"], ["kaan", "Kaan"], ["bangla", "Bangladesh"], ["karan", "Karan"], ["giz", "GIZ"]], () => fSrc, k => fSrc = k);
  segBtns("fRes", [["semua", "Semua"], ...[["cocok", "Sesuai"], ["meleset", "Tidak sesuai"], ["alarm", "OOD"], ["lapangan", "Lapangan"]]
    .filter(([k]) => nStat(k) > 0).map(([k, l]) => [k, `${l} (${nStat(k)})`])], () => fRes, k => fRes = k);
  $("cobaN").textContent = D.cards.length;
  function drawGallery() {
    const list = D.cards.filter(c => (fSrc === "semua" || c.src === fSrc) && (fRes === "semua" || c.status === fRes));
    $("cobaCount").textContent = `${list.length} foto ditampilkan`;
    $("gallery").innerHTML = list.length ? list.map(pcard).join("") : `<p class="empty">Tidak ada foto untuk kombinasi filter ini. Pilih "Semua" pada salah satu filter.</p>`;
    $("gallery").querySelectorAll(".pcard").forEach(b => b.onclick = () => {
      $("gallery").querySelectorAll(".pcard").forEach(x => x.setAttribute("aria-pressed", x === b));
      renderResult($("cobaPanel"), D.cards.find(c => c.id === +b.dataset.id));
    });
  }
  drawGallery();
  renderResult($("cobaPanel"), null);

  // ================= 16 KELOMPOK =================
  const filters = $("filters"), cards = $("cards"), dlg = $("dlg");
  const gal = c => `assets/c${String(c.id).padStart(2, "0")}.jpg`;
  function openCluster(c, opener) {
    dlg._opener = opener;
    $("dlgTitle").textContent = `C${c.id} · ${c.name}`;
    $("dlgMeta").textContent = `${c.n} foto · kategori ${CATNAME[c.cat]}`;
    const img = $("dlgImg"), load = $("dlgLoading");
    load.hidden = false; load.className = "muted"; load.textContent = "Memuat galeri..."; img.hidden = true;
    img.alt = `24 foto contoh cluster ${c.name}`;
    img.onload = () => { load.hidden = true; img.hidden = false; };
    img.onerror = () => { load.className = "err"; load.textContent = `Galeri tidak ditemukan: ${gal(c)}`; };
    img.src = gal(c);
    $("dlgFacts").innerHTML = `<div class="card"><div class="label">Penanganan</div><p>${c.handling}</p></div>
       <div class="card"><div class="label">B3</div><p>${c.b3 ? "Mengandung B3" : "Tidak termasuk kategori B3 utama"}</p></div>
       <div class="card"><div class="label">Stability (Jaccard)</div><p><b>${fmt(c.jaccard, 2)}</b> · ${c.jaccard >= .85 ? "aman di atas 0,85" : "di bawah 0,85"}</p></div>`;
    hideTip(); dlg.showModal();
  }
  $("dlgClose").onclick = () => dlg.close();
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => dlg._opener && dlg._opener.focus());
  $("clusterKey").innerHTML = Object.entries(CATCOLORS).map(([k, color]) => `<span><i class="sw" style="background:${color};border-radius:3px"></i>${CATNAME[k]}</span>`).join("");
  function showCards(cat) {
    filters.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.cat === cat));
    cards.innerHTML = "";
    const list = C.filter(c => cat === "semua" || (cat === "b3" ? c.b3 : c.cat === cat));
    if (!list.length) { cards.innerHTML = '<p class="empty">Tidak ada cluster untuk filter ini.</p>'; return; }
    list.forEach(c => {
      const b = document.createElement("button"); b.className = "ccard"; b.type = "button";
      b.setAttribute("aria-label", `Buka galeri cluster ${c.id}: ${c.name}, ${c.n} foto`);
      b.innerHTML = `<div class="strip"><img src="${gal(c)}" alt="" loading="lazy"></div>
        <span class="t">C${c.id} · ${c.name}${c.id === 15 ? " (campuran)" : ""}</span>
        <span class="meta"><span class="num">${c.n} foto</span>${c.b3 ? '<span class="chip b3">B3</span>' : `<span>${CATNAME[c.cat]}</span>`}</span>`;
      const im = b.querySelector("img");
      im.onerror = () => { im.parentElement.outerHTML = `<p class="err">Gambar tidak ditemukan: ${gal(c)}</p>`; };
      b.onclick = () => openCluster(c, b);
      cards.appendChild(b);
    });
  }
  [["semua", "Semua"], ...Object.entries(CATNAME), ["b3", "Mengandung B3"]].forEach(([k, l]) => {
    const b = document.createElement("button"); b.className = "btn"; b.type = "button"; b.dataset.cat = k; b.textContent = l; b.onclick = () => showCards(k); filters.appendChild(b); });
  showCards("semua");

  (() => {
    const kd = E.scen.kdist, total = kd.reduce((s, d) => s + d.n, 0), top = kd.reduce((a, b) => b.n > a.n ? b : a), n16 = kd.find(d => d.k === 16);
    const k16 = E.scen.k17.find(k => k.k === 16), k17 = E.scen.k17.find(k => k.k === 17), members = new Set(D.k17.members);
    $("k17list").innerHTML = `
      <li><b>17 jadi modus, 16 di urutan kedua.</b>Dari ${total} iterasi SCMax, K = 17 terpilih ${top.n} kali dan K = 16 terpilih ${n16 ? n16.n : 0} kali.</li>
      <li><b>16 lebih stabil.</b>Spectral clustering dengan K = 16 memberi pembagian yang identik di 100 percobaan (ARI ${fmt(k16.ari, 2)}). Dengan K = 17, ARI turun ke ${fmt(k17.ari, 2)}.</li>
      <li><b>Percobaan awal juga memberi 16.</b>Sembilan percobaan awal SCMax memilih ${E.robust.scmax.join(", ")}; mediannya 16.</li>
      <li><b>Cluster ke-17 mengikuti background.</b>${members.size} foto tumpukan dengan background serupa memisah. Kaitan cluster dengan gaya foto naik dari ${fmt(k16.style, 2)} ke ${fmt(k17.style, 2)}, sedangkan consistency hanya naik dari ${fmt(k16.xsrc)} ke ${fmt(k17.xsrc)}, masih di dalam CI 95%.</li>
      <li><b>Akibatnya</b>PCB dan tumpukan campuran tetap satu cluster, yaitu C15.</li>`;
    const kmap = $("kmap"), g = el("g", {}, kmap), bdcPts = D.pts.filter(p => p[5] < 2);
    const kmarks = bdcPts.map(p => el("circle", { cx: MX(p[2]), cy: MY(p[3]), r: 2.4 }, g));
    const draw = k => {
      root.querySelectorAll("[data-kval]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.kval === k));
      kmarks.forEach((m, i) => { const p = bdcPts[i], isNew = k === 17 && members.has(p[6]); m.setAttribute("fill", isNew ? TERRA : p[4] === 15 ? FOCUS : "#d3e0d6"); });
      $("k17cap").textContent = k === 16 ? `K = 16: C15 berisi ${C[15].n} foto PCB dan tumpukan campuran.` : `K = 17: ${members.size} foto membentuk cluster baru. Contohnya ada di samping: tumpukan campuran dengan background serupa.`;
    };
    root.querySelectorAll("[data-kval]").forEach(b => b.onclick = () => draw(+b.dataset.kval));
    draw(16);
    const withThumb = D.k17.members.filter(id => { const p = D.pts[idx.get(id)]; return p && p[7]; }), step = Math.max(1, Math.floor(withThumb.length / 12));
    $("k17thumbs").innerHTML = withThumb.filter((_, i) => i % step === 0).slice(0, 12).map(id => imgTag(thumb(id), "Contoh foto cluster tambahan K = 17")).join("");
    const svg = $("kDist"), W = 560, H = 240, B = 200, mx = Math.max(...kd.map(d => d.n)), bw = (W - 60) / kd.length;
    fit(svg, W, H);
    [0, 10, 20].forEach(t => { const y = B - t / mx * 170; el("line", { x1: 40, x2: W - 10, y1: y, y2: y, class: "grid" }, svg); txt(svg, 32, y + 4, t, { "text-anchor": "end", "font-size": 12 }); });
    kd.forEach((d, i) => { const x = 48 + i * bw, h = d.n / mx * 170;
      const r = el("rect", { x, y: B - h, width: bw - 10, height: h, rx: 4, fill: d.k === 16 ? FOCUS : d.k === 17 ? TERRA : CONTEXT }, svg);
      txt(svg, x + (bw - 10) / 2, B + 18, d.k, { "text-anchor": "middle", class: "ink", "font-size": 13 });
      txt(svg, x + (bw - 10) / 2, B - h - 6, d.n, { "text-anchor": "middle", "font-size": 12 });
      bindTip(r, `<b>K = ${d.k}</b><br>${d.n} percobaan · consistency rata-rata ${fmt(d.xsrc)}`); });
    txt(svg, W / 2, H - 4, "K pilihan SCMax", { "text-anchor": "middle", "font-size": 12 });
    table("kDistT", ["K", "Percobaan", "Consistency rata-rata"], kd.map(d => [String(d.k), String(d.n), d.xsrc]));
  })();

  (() => {
    const svg = $("clMap"), P = E.clusterMap, W = 760, H = 520;
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = v => 28 + (W - 56) * (v - x0) / (x1 - x0), Y = v => H - 28 - (H - 56) * (v - y0) / (y1 - y0);
    el("rect", { x: .5, y: .5, width: W - 1, height: H - 1, rx: 16, fill: "none", stroke: LINE }, svg);
    const ms = P.map(([x, y, c, t]) => { const cx = X(x), cy = Y(y), fill = CATCOLORS[C[c].cat];
      const m = t ? el("path", { d: `M${cx} ${cy - 4}l3.5 6h-7z`, fill, stroke: "#fff", "stroke-width": .6 }, svg) : el("circle", { cx, cy, r: 2.4, fill, "fill-opacity": .75 }, svg);
      m.dataset.c = c; return m; });
    const focus = c => ms.forEach(m => m.style.opacity = c == null || +m.dataset.c === c ? 1 : .08);
    const tipFor = cl => `<b>C${cl.id} · ${cl.name}</b><br>${cl.n} foto · ${CATNAME[cl.cat]}<br>klik untuk membuka galeri`;
    const labels = [];
    C.forEach(cl => {
      const pts = P.filter(p => p[2] === cl.id).map(p => [X(p[0]), Y(p[1])]);
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const [lx, ly] = pts.reduce((b, p) => Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(b[0] - mx, b[1] - my) ? p : b);
      const g = el("g", { tabindex: 0, role: "button", "aria-label": `C${cl.id} ${cl.name}, ${cl.n} foto. Buka galeri`, style: "cursor:pointer" }, svg);
      labels.push([g, cl]);
      txt(g, lx, ly + 4, `C${cl.id}`, { "text-anchor": "middle", class: "strong", "paint-order": "stroke", stroke: "#fff", "stroke-width": 5, "stroke-linejoin": "round" });
      g.onmouseenter = e => { focus(cl.id); showTip(tipFor(cl), e.clientX, e.clientY); };
      g.onmouseleave = () => { focus(null); hideTip(); };
      g.onfocus = () => focus(cl.id); g.onblur = () => focus(null);
      g.onclick = () => openCluster(cl, g);
      g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCluster(cl, g); } };
    });
    svg.addEventListener("mousemove", e => { const c = e.target.dataset && e.target.dataset.c; if (c != null) showTip(tipFor(C[+c]), e.clientX, e.clientY); });
    svg.addEventListener("click", e => { const c = e.target.dataset && e.target.dataset.c; if (c != null) openCluster(C[+c], svg); });
    svg.addEventListener("mouseleave", hideTip);
    const hiddenCat = new Set(), cats = [...new Set(C.map(c => c.cat))];
    const applyFilter = () => { ms.forEach(m => m.style.display = hiddenCat.has(C[+m.dataset.c].cat) ? "none" : "");
      labels.forEach(([g, cl]) => g.style.display = hiddenCat.has(cl.cat) ? "none" : ""); };
    cats.forEach(k => {
      const b = document.createElement("button"), n = C.filter(c => c.cat === k).reduce((t, c) => t + c.n, 0);
      b.type = "button"; b.className = "btn"; b.setAttribute("aria-pressed", "true");
      b.innerHTML = `<i class="sw" style="background:${CATCOLORS[k]}"></i>${CATNAME[k]} (${n.toLocaleString("id-ID")})`;
      b.onclick = () => { hiddenCat.has(k) ? hiddenCat.delete(k) : hiddenCat.add(k); b.setAttribute("aria-pressed", !hiddenCat.has(k)); applyFilter(); };
      $("mapFilter").appendChild(b);
    });
    const LBL = "fill:#fff;stroke:rgba(19,41,61,.7);stroke-width:3px;paint-order:stroke;stroke-linejoin:round";
    const tree = $("clTree"), TW = 760, TH = 320, total = C.reduce((t, c) => t + c.n, 0);
    let tx = 0;
    cats.map(k => ({ k, n: C.filter(c => c.cat === k).reduce((t, c) => t + c.n, 0) })).sort((a, b) => b.n - a.n).forEach(({ k, n }) => {
      const w = TW * n / total; let ty = 0;
      C.filter(c => c.cat === k).sort((a, b) => b.n - a.n).forEach(cl => {
        const h = TH * cl.n / n;
        const g = el("g", { tabindex: 0, role: "button", "aria-label": `C${cl.id} ${cl.name}, ${cl.n} foto. Buka galeri`, style: "cursor:pointer" }, tree);
        el("rect", { x: tx + 1, y: ty + 1, width: Math.max(0, w - 2), height: Math.max(0, h - 2), rx: 8, fill: CATCOLORS[k] }, g);
        if (w > 40 && h > 34) {
          txt(g, tx + w / 2, ty + h / 2 - 3, `C${cl.id}`, { "text-anchor": "middle", style: LBL, "font-size": 13 });
          txt(g, tx + w / 2, ty + h / 2 + 13, `${cl.n} foto`, { "text-anchor": "middle", style: LBL, "font-size": 11 });
        }
        g.onmouseenter = e => { focus(cl.id); showTip(tipFor(cl), e.clientX, e.clientY); };
        g.onmousemove = e => showTip(tipFor(cl), e.clientX, e.clientY);
        g.onmouseleave = () => { focus(null); hideTip(); };
        g.onclick = () => openCluster(cl, g);
        g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCluster(cl, g); } };
        ty += h;
      });
      tx += w;
    });
    const nTest = C.map(cl => P.filter(p => p[2] === cl.id && p[3]).length);
    table("grpTbl", ["Cluster", "Nama", "Kategori", "B3", "Foto", "Latih", "Uji", "Label BDC dominan", "Disepakati 3 algoritma", "Background putih", "Jaccard", "Foto GIZ masuk"],
      C.map((cl, i) => [`C${cl.id}`, cl.name, CATNAME[cl.cat], cl.b3 ? "ya" : "tidak", String(cl.n), String(cl.n - nTest[i]), String(nTest[i]),
                        cl.top_share == null ? "–" : `${cl.top_label} (${pct(cl.top_share)})`, pct(cl.agree3), pct(cl.white_bg), fmt(cl.jaccard, 2), String(cl.giz_n)]), true);
  })();
  (() => {
    const svg = $("clChart"), list = [...C].sort((a, b) => b.n - a.n);
    const left = 320, X = v => left + 280 * v / 700, jx0 = 690, jx1 = 870, J = v => jx0 + (jx1 - jx0) * (v - .6) / .4, rowH = 30, top = 40;
    const bottom = top + list.length * rowH;
    txt(svg, left, 16, "Jumlah foto", { class: "strong" }); txt(svg, jx0, 16, "Stability (Jaccard)", { class: "strong" });
    [0, 200, 400, 600].forEach(t => { el("line", { x1: X(t), x2: X(t), y1: top, y2: bottom, class: t ? "grid" : "base" }, svg); txt(svg, X(t), bottom + 18, t.toLocaleString("id-ID"), { "text-anchor": "middle", class: "num" }); });
    [.6, .8, 1].forEach(t => { el("line", { x1: J(t), x2: J(t), y1: top, y2: bottom, class: "grid" }, svg); txt(svg, J(t), bottom + 18, fmt(t, 1), { "text-anchor": "middle", class: "num" }); });
    el("line", { x1: J(.85), x2: J(.85), y1: top - 4, y2: bottom, stroke: INK, "stroke-width": 1 }, svg); txt(svg, J(.85), top - 8, "0,85", { "text-anchor": "middle", class: "ink num" });
    list.forEach((c, i) => {
      const y = top + i * rowH, cy = y + rowH / 2, g = el("g", { class: "row", role: "button", "aria-label": `Buka galeri C${c.id} ${c.name}` }, svg);
      el("rect", { x: 0, y, width: 940, height: rowH, class: "hit" }, g);
      if (c.b3) txt(g, 0, cy + 4, "B3", { class: "ink strong" });
      txt(g, left - 10, cy + 4, `C${c.id} · ${c.name}`, { "text-anchor": "end", class: "ink" });
      el("path", { d: hbarPath(left, cy - 7, X(c.n) - left, 14), fill: CATCOLORS[c.cat], class: "bar" }, g);
      txt(g, X(c.n) + 6, cy + 4, c.n, { class: "ink num" });
      el("circle", { cx: J(c.jaccard), cy, r: 5, fill: c.jaccard >= .85 ? INK : TERRA, stroke: "#fff", "stroke-width": 2 }, g);
      bindTip(g, `<b>C${c.id} · ${c.name}</b><br>${CATNAME[c.cat]} · ${c.n} foto · Jaccard ${fmt(c.jaccard, 2)}${c.b3 ? "<br>mengandung B3" : ""}<br>klik untuk galeri`);
      g.style.cursor = "pointer"; g.addEventListener("click", () => openCluster(c, g));
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCluster(c, g); } });
    });
    fit(svg, 940, bottom + 28);
    table("clTbl", ["Cluster", "Foto", "Jaccard", "B3"], list.map(c => [`C${c.id} · ${c.name}`, String(c.n), c.jaccard, c.b3 ? "ya" : "tidak"]));
  })();

  // ================= CARA KERJA CMRE: follow two real mouse photos through the method =================
  // Bar heights and the A-B difference meter are illustrations; step 8 replays the real joint t-SNE from demo.js.
  const cmre = (() => {
    const S = $("cmre"), OBJ = "#168aad", SRC = TERRA;
    const OBJ_H = [.82, .55, .92, .42, .7, .62, .86, .5];
    const A_OBJ = OBJ_H, B_OBJ = OBJ_H.map((h, i) => Math.max(.2, h + [.04, -.05, .03, .05, -.04, .03, -.03, .04][i]));
    const A_SRC = [.92, .22, .8, .3], B_SRC = [.2, .88, .26, .9];  // different background "fingerprints" for the two photos
    let timers = [], step = 0;
    const later = (ms, f) => timers.push(setTimeout(f, reduced ? 0 : ms));
    const stopT = () => { timers.forEach(clearTimeout); timers = []; };
    const move = (g, x, y, o = 1) => { g.style.transform = `translate(${x}px,${y}px)`; g.style.opacity = o; };
    const grp = () => { const g = el("g", { class: "mv" }, S); g.style.opacity = 0; return g; };
    function vec(label, obj, src, h = 80) {
      const g = grp(), t = txt(g, 0, -12, label, { class: "lbl" });
      const H = [...obj, ...src];
      const bars = H.map((v, i) => { const r = el("rect", { x: i * 22, y: h - h * v, width: 17, height: h * v, rx: 3, fill: i < 8 ? OBJ : SRC, class: "bar" }, g); r.style.transform = "scaleY(0)"; return r; });
      el("line", { x1: -3, x2: 12 * 22 - 2, y1: h + .5, y2: h + .5, stroke: "#b9cbc0" }, g);
      return { g, t, set: (o, s) => bars.forEach((b, i) => b.style.transform = `scaleY(${i < 8 ? o : s})`) };
    }
    function photo(cardId, caption) {
      const g = grp(); el("rect", { x: 0, y: 0, width: 140, height: 140, rx: 16, fill: "#f2f3f5" }, g);
      el("image", { x: 6, y: 6, width: 128, height: 128, preserveAspectRatio: "xMidYMid slice", href: big(cardId) }, g);
      txt(g, 70, 162, caption, { class: "sm", "text-anchor": "middle" });
      return g;
    }
    const pickCard = (src, lab) => D.cards.find(c => c.src === src && c.label === lab && c.status === "cocok") || D.cards.find(c => c.src === src) || D.cards[0];
    const cA = pickCard("kaan", "mouse"), cB = pickCard("bangla", "mouse");
    const pA = photo(cA.id, "Foto A · katalog (Kaan)"), pB = photo(cB.id, "Foto B · objek (Bangladesh)");
    const eq = grp(); txt(eq, 0, 0, "=", { class: "big", "text-anchor": "middle" }); txt(eq, 0, 30, "sama-sama mouse", { class: "sm", "text-anchor": "middle" });
    const vA = vec("embedding foto A", A_OBJ, A_SRC), vB = vec("embedding foto B", B_OBJ, B_SRC);
    const legend = grp(); [[OBJ, "fitur barang"], [SRC, "background dan cara memotret"]].forEach(([c, l], i) => { el("rect", { x: i * 150, y: 0, width: 14, height: 14, rx: 3, fill: c }, legend); txt(legend, i * 150 + 22, 12, l, { class: "sm" }); });
    // difference meter between A and B, computed from the illustrated bars (object part + whatever source part remains)
    const meter = grp(); txt(meter, 0, -10, "jarak embedding foto A dan B", { class: "lbl" });
    el("rect", { x: 0, y: 0, width: 520, height: 16, rx: 8, fill: "#f2f3f5" }, meter);
    const mFill = el("rect", { x: 0, y: 0, width: 520, height: 16, rx: 8, fill: SRC, class: "grow" }, meter); mFill.style.transform = "scaleX(0)";
    const mLbl = txt(meter, 530, 13, "", { class: "lbl" });
    const diff = s => Math.sqrt(A_OBJ.reduce((t, a, i) => t + (a - B_OBJ[i]) ** 2, 0) + A_SRC.reduce((t, a, i) => t + (s * (a - B_SRC[i])) ** 2, 0));
    const dMax = diff(1);
    const setMeter = s => { mFill.style.transform = `scaleX(${diff(s) / dMax})`; mFill.setAttribute("fill", s > .5 ? SRC : OBJ); mLbl.textContent = s > .5 ? "jauh" : "dekat"; };
    // single-photo pipeline for B: actual, DINOv3 guess, residual
    const vB2 = vec("embedding asli foto B (vision-language)", B_OBJ, B_SRC), vG = vec("tebakan DINOv3 untuk foto B", B_OBJ, [.06, .05, .07, .05]), vR = vec("residual = asli − tebakan", B_OBJ.map(() => .05), B_SRC.map(v => v - .05));
    const dino = grp(); el("rect", { x: 0, y: 0, width: 150, height: 70, rx: 14, fill: "#184e77" }, dino);
    txt(dino, 75, 32, "DINOv3", { class: "lbl", "text-anchor": "middle", style: "fill:#f3f8ee" }); txt(dino, 75, 52, "belajar dari foto saja", { class: "sm", "text-anchor": "middle", style: "fill:#cfe3ee" });
    const arrow = grp(); el("path", { d: "M0 0H70", stroke: "#184e77", "stroke-width": 2, fill: "none" }, arrow); el("path", { d: "M70 -6L82 0L70 6Z", fill: "#184e77" }, arrow);
    // step 5 is a column subtraction: actual − guess = residual; each operator carries a word so it reads as arithmetic
    const op = (sign, word) => { const g = grp(); txt(g, 0, 0, sign, { class: "big", "text-anchor": "middle" }); txt(g, 0, 22, word, { class: "sm", "text-anchor": "middle" }); return g; };
    const minus = op("−", "dikurangi"), equals = op("=", "hasilnya");
    // step 6: residuals of many photos share the same source columns
    const many = grp(), manyRows = [];
    const rnd = (() => { let s = 11; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();
    for (let r = 0; r < 6; r++) {
      const v = vec(r ? "" : "residual dari banyak foto", Array(8).fill(0).map(() => .04 + rnd() * .1), Array(4).fill(0).map(() => .45 + rnd() * .5), 44);
      many.appendChild(v.g); v.g.style.opacity = 1; v.g.style.transform = `translate(0px,${r * 58}px)`; manyRows.push(v);
    }
    const band = el("rect", { x: 8 * 22 - 6, y: -30, width: 4 * 22 + 8, height: 6 * 58 + 10, rx: 10, fill: "none", stroke: "#184e77", "stroke-width": 2.5, "stroke-dasharray": "6 5", class: "fade" }, many); band.style.opacity = 0;
    const bandLbl = txt(many, 8 * 22 + 4 * 11, 6 * 58 + 6, "pola yang sama di banyak foto", { class: "lbl fade", "text-anchor": "middle" }); bandLbl.style.opacity = 0;
    // step 8: real data
    const real = grp(), RX = v => 30 + v * .74, RY = v => 20 + v * .41;
    const rpts = D.pts.map(p => { const ext = p[5] >= 2; return [el("circle", { r: ext ? 3.4 : 1.8, cx: 0, cy: 0, fill: ext ? SRCCOL[D.src[p[5]]] : SRCCOL.bdc, class: "rp" }, real), p]; });
    rpts.filter(([, p]) => p[5] >= 2).forEach(([c]) => real.appendChild(c));
    [[SRCCOL.bdc, "foto BDC"], [SRCCOL.kaan, "Kaan"], [SRCCOL.bangla, "Bangladesh"], [SRCCOL.karan, "Karan"], [SRCCOL.giz, "GIZ"]].forEach(([c, l], i) => { el("circle", { cx: 40 + i * 116, cy: 446, r: 6, fill: c }, real); txt(real, 52 + i * 116, 451, l, { class: "sm" }); });
    const rLbl = txt(real, 30, 26, "", { class: "hd" });
    const placeReal = t => rpts.forEach(([c, p]) => c.style.transform = `translate(${RX(p[0] + (p[2] - p[0]) * t)}px,${RY(p[1] + (p[3] - p[1]) * t)}px)`);
    const realMorph = morphControl($("cmreMorph"), (t, final) => {
      S.classList.toggle("scrub", !final || reduced); placeReal(t);
      rLbl.textContent = t === 0 ? `Sebelum CMRE · consistency ${fmt(bdc.raw, 3)}` : t === 1 ? `Sesudah CMRE · consistency ${fmt(bdc.cmre, 3)}` : "Peralihan (dijeda)";
    }, { start: 0 });

    const all = [pA, pB, eq, vA.g, vB.g, legend, meter, vB2.g, vG.g, vR.g, dino, arrow, minus, equals, many, real];
    const reset = () => {
      stopT(); realMorph.stop(); all.forEach(g => g.style.opacity = 0); [vA, vB, vB2, vG, vR].forEach(v => v.set(0, 0));
      mFill.style.transform = "scaleX(0)"; mLbl.textContent = ""; band.style.opacity = 0; bandLbl.style.opacity = 0;
      manyRows.forEach(v => v.set(0, 0)); $("cmreMorph").hidden = true;
    };
    const STEPS = [
      ["Bagi kita, ini barang yang sama", "Foto A berasal dari katalog toko dengan background putih. Foto B berasal dari dataset Bangladesh, dengan background hijau. Siapa pun langsung tahu keduanya mouse.", "ilustrasi dengan foto asli", () => {
        move(pA, 150, 110); move(pB, 510, 110); move(eq, 400, 180); }],
      ["Model mengubah foto jadi embedding", "Model membaca foto sebagai embedding, yaitu deretan angka. Pada vision-language model, angka itu memuat fitur barang (biru) serta background dan cara memotret (oranye).", "ilustrasi", () => {
        move(pA, 105, 20); move(pB, 505, 20); move(vA.g, 40, 230); move(vB.g, 440, 230); move(legend, 230, 400);
        later(400, () => vA.set(1, 1)); later(700, () => vB.set(1, 1)); }],
      ["Background bias membuat keduanya tampak berbeda", "Bagian oranye foto A dan B jauh berbeda, jadi embedding-nya berjauhan dan model memisahkan dua mouse ini. Pada vision-language model, hanya 37 sampai 57 dari 100 foto Bangladesh berkumpul dengan foto katalog sejenisnya.", "ilustrasi", () => {
        move(pA, 105, 20); move(pB, 505, 20); move(vA.g, 40, 230); move(vB.g, 440, 230); vA.set(1, 1); vB.set(1, 1); move(meter, 120, 400);
        later(500, () => setMeter(1)); }],
      ["Inti CMRE 1 · DINOv3 menebak", "Sekarang fokus ke foto B. DINOv3 belajar dari foto tanpa teks, jadi ia hanya melihat fitur barang. CMRE memakai DINOv3 untuk menebak embedding vision-language model (ridge regression). Tebakannya hanya memuat bagian biru.", "ilustrasi", () => {
        move(pB, 66, 40); move(vB2.g, 330, 50); vB2.set(1, 1); move(dino, 30, 260); move(arrow, 200, 300); move(vG.g, 330, 260);
        later(700, () => vG.set(1, 1)); }],
      ["Inti CMRE 2 · Hitung residual", "Embedding asli dikurangi tebakan. Fitur barang saling menghapus, jadi residual yang tersisa hampir seluruhnya background bias. Mirip headphone noise-cancelling: suara sekitar direkam dulu, lalu dihapus.", "ilustrasi", () => {
        move(vB2.g, 270, 30); vB2.set(1, 1); move(vG.g, 270, 175); vG.set(1, 1); move(minus, 225, 226); move(vR.g, 270, 330); move(equals, 225, 381);
        later(800, () => vR.set(1, 1)); }],
      ["Inti CMRE 3 · Cari pola residual yang berulang", "CMRE mengumpulkan residual dari 3.792 foto. PCA mencari 64 principal direction dengan varians residual terbesar. Direction ini berkorelasi dengan ukuran foto (hingga 0,68) dan background putih (0,39).", "ilustrasi", () => {
        move(many, 270, 50); manyRows.forEach((v, i) => later(150 * i, () => v.set(1, 1)));
        later(1300, () => { band.style.opacity = 1; bandLbl.style.opacity = 1; }); }],
      ["Inti CMRE 4 · Buang pola itu", "CMRE menghapus komponen yang searah dengan direction itu dari embedding semua foto (orthogonal projection). Fitur barang tetap utuh. Embedding foto A dan B kini berdekatan, jadi dua mouse ini masuk cluster yang sama.", "ilustrasi", () => {
        move(pA, 105, 20); move(pB, 505, 20); move(vA.g, 40, 230); move(vB.g, 440, 230); vA.set(1, 1); vB.set(1, 1); move(meter, 120, 400); setMeter(1);
        later(900, () => { vA.set(1, 0); vB.set(1, 0); setMeter(0); }); }],
      ["Hasilnya pada data asli", "Ini peta t-SNE dari data asli. Tekan Putar untuk melihat foto dari dataset lain (berwarna) bergeser mendekati foto BDC (abu-abu). Tekan Jeda kapan saja, atau geser slider.", "data asli", () => {
        move(real, 0, 0); $("cmreMorph").hidden = false; realMorph.set(0, true); }]];
    const dotsBox = $("cmreDots");
    STEPS.forEach((s, i) => { const b = document.createElement("button"); b.type = "button"; b.textContent = i + 1; b.setAttribute("aria-label", `Langkah ${i + 1}: ${s[0]}`); b.onclick = () => go(i); dotsBox.appendChild(b); });
    function go(i) {
      step = (i + STEPS.length) % STEPS.length;
      const [title, text, tag, run] = STEPS[step];
      reset(); requestAnimationFrame(() => requestAnimationFrame(run));
      $("cmreN").textContent = `Langkah ${step + 1} dari ${STEPS.length}`; $("cmreTitle").textContent = title; $("cmreText").textContent = text;
      $("cmreTag").textContent = tag; $("cmreTag").className = "chip tag " + (tag === "data asli" ? "cocok" : "lapangan");
      dotsBox.querySelectorAll("button").forEach((b, j) => j === step ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current"));
      $("cmreNext").textContent = step === STEPS.length - 1 ? "Ulang dari awal" : "Berikutnya";
    }
    $("cmrePrev").onclick = () => go(step - 1);
    $("cmreNext").onclick = () => go(step + 1);
    $("cmreReplay").onclick = () => go(step);
    let x0 = null;
    const panel = S.closest(".cmre-grid");  // swipe anywhere on the panel, except while dragging the step-8 slider
    panel.addEventListener("pointerdown", e => x0 = e.target.closest("input") ? null : e.clientX);
    panel.addEventListener("pointerup", e => { if (x0 == null) return; const d = e.clientX - x0; x0 = null; if (Math.abs(d) > 50) go(step + (d < 0 ? 1 : -1)); });
    root.addEventListener("keydown", e => { if (S.closest(".view").hidden || e.defaultPrevented || e.target.matches("input")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(step + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(step - 1); } });
    return { start: () => go(step) };
  })();

  // ================= ANALISIS: ALUR =================
  const os = E.oodSummary.shubha;
  const STAGES = [
    ["Lihat", "Tiga model mengubah tiap foto menjadi embedding (deretan angka).", "consistency " + fmt(bdc.raw, 2), `Bila ketiga embedding langsung digabung (raw fusion), consistency-nya hanya ${fmt(bdc.raw, 3)}. Vision-language model ikut membaca background, jadi source bias menumpuk.`],
    ["Bersihkan", "CMRE membuang source bias.", "consistency " + fmt(bdc.cmre, 2), `DINOv3 menebak embedding SigLIP2 dan PE-Core-G. Residual yang tidak bisa ditebak dianggap source bias; 64 principal direction-nya dibuang, lalu ketiga embedding digabung lagi. Consistency naik dari ${fmt(bdc.raw, 3)} ke ${fmt(bdc.cmre, 3)} tanpa label.`],
    ["Clustering", "SCMax memilih 16, Spectral membentuknya.", "16 cluster", "SCMax memilih jumlah cluster tanpa label (median 9 percobaan = 16). Spectral clustering membagi 15-NN graph menjadi 16 cluster; hasilnya identik di 100 percobaan."],
    ["Jaga", "Foto baru ditempatkan, foto asing ditandai.", "alarm " + fmt(os.auc, 2), `Foto baru masuk ke cluster dengan centroid terdekat tanpa mengulang clustering. Bila jarak ke nearest neighbor ke-10 melewati threshold, foto ditandai untuk dicek petugas. AUROC ${fmt(os.auc, 3)} pada data Shubha.`]];
  STAGES.forEach(([t, s, n, d], i) => {
    const b = document.createElement("button"); b.className = "stage-btn"; b.type = "button";
    b.setAttribute("aria-expanded", i === 1); b.setAttribute("aria-controls", "stageDetail");
    b.innerHTML = `<span class="n">Tahap ${i + 1}</span><h3>${t}</h3><span>${s}</span><span class="big num">${n}</span>`;
    b.onclick = () => { $("stages").querySelectorAll(".stage-btn").forEach(x => x.setAttribute("aria-expanded", x === b)); $("stageDetail").innerHTML = `<h3>${i + 1}. ${t}</h3><p>${d}</p>`; };
    $("stages").appendChild(b);
  });
  $("stageDetail").innerHTML = `<h3>2. ${STAGES[1][0]}</h3><p>${STAGES[1][3]}</p><p><a href="#cara-kerja">Lihat animasinya di halaman Cara kerja CMRE</a></p>`;
  [["Input", "3.792 foto e-waste", "3.604 foto train BDC setelah deduplication, ditambah 188 foto dari test set BDC yang terdeteksi sebagai e-waste. Filename label hanya untuk evaluasi."],
   ["Preprocessing", "deduplication, flip TTA", "Foto duplikat dibuang dengan perceptual hash (jarak Hamming ≤ 6). Tiap foto dibaca dua kali, asli dan versi flip-nya, lalu embedding-nya dirata-rata."],
   ["Feature extraction", "3 frozen backbone", "SigLIP2-So400m dan PE-Core-G (vision-language) serta DINOv3-H+ (tanpa teks). Hanya image encoder yang dipakai."],
   ["CMRE", "buang source bias", "Ridge regression menebak embedding vision-language dari DINOv3; 64 principal direction dari residual-nya dibuang. Tanpa label kelas, label sumber, atau style proxy."],
   ["Fusion dan PCA-32", "tiga embedding jadi satu", "Embedding yang sudah dibersihkan digabung dengan DINOv3, diringkas ke 32 dimensi, lalu dinormalisasi."],
   ["Pilih K", "SCMax, 9 percobaan", "SCMax memilih 13, 16, 13, 16, 19, 16, 15, 19, 19. Mediannya 16."],
   ["Clustering", "Spectral, 15-NN", "15-NN graph dibagi dengan Spectral clustering. K-Means, Ward, dan GMM diuji sebagai baseline."],
   ["Output", "16 cluster dan alarm", "Nama cluster ditentukan dari galeri foto. Foto yang jauh dari data BDC ditandai lewat jarak ke nearest neighbor ke-10, dengan threshold persentil ke-95."]].forEach(([t, s, d], i) => {
    const b = document.createElement("button"); b.className = "step"; b.type = "button";
    b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", "stepDetail");
    b.innerHTML = `<span class="n">Langkah ${i + 1}</span><h3>${t}</h3><span class="s">${s}</span>`;
    b.onclick = () => { $("steps").querySelectorAll(".step").forEach(x => x.setAttribute("aria-expanded", x === b)); $("stepDetail").innerHTML = `<h3>${i + 1}. ${t}</h3><p>${d}</p>`; };
    $("steps").appendChild(b);
  });

  // ================= ANALISIS: DATA =================
  (() => {
    const ed = D.eda, n = ed.size.reduce((a, b) => a + b, 0), num = v => v.toLocaleString("id-ID");
    const white = C.reduce((s, c) => s + c.white_bg * c.n, 0) / C.reduce((s, c) => s + c.n, 0);  // weighted from the per-cluster shares in data.js
    $("edaSub").textContent = `${num(ed.split.train)} foto train dan ${ed.split.test} foto dari test set. ${pct((ed.size[0] + ed.size[1] + ed.size[2]) / n)} foto dengan sisi terpanjang kurang dari 200 piksel; sekitar ${pct(white)} dengan background putih.`;
    const mx = Math.ceil(Math.max(...ed.size) / 500) * 500;
    fit($("edaSize"), 440, hbars($("edaSize"), ed.size.map((v, i) => ({ label: ed.sizeLabels[i], value: v, focus: i < 3, tip: `<b>${ed.sizeLabels[i]} px</b><br>${num(v)} foto` })),
      { W: 440, left: 80, right: 56, rowH: 30, barH: 14, max: mx, ticks: [0, mx / 2, mx], tickFmt: num, valueFmt: num }));
    table("edaSizeT", ["Ukuran (px)", "Foto"], ed.sizeLabels.map((l, i) => [l, String(ed.size[i])]));
    const labs = Object.entries(ed.labels).sort((a, b) => b[1] - a[1]), lm = Math.ceil(labs[0][1] / 500) * 500;
    fit($("edaLab"), 440, hbars($("edaLab"), labs.map(([k, v]) => ({ label: LABEL[k] || k, value: v, focus: k !== "tanpa label", tip: `<b>${LABEL[k] || k}</b><br>${num(v)} foto` })),
      { W: 440, left: 110, right: 56, rowH: 26, barH: 12, max: lm, ticks: [0, lm / 2, lm], tickFmt: num, valueFmt: num }));
    table("edaLabT", ["Label", "Foto"], labs.map(([k, v]) => [LABEL[k] || k, String(v)]));
  })();
  (() => {
    const NAMES = { battery: "Baterai", keyboard: "Keyboard", mobile: "Ponsel", mouse: "Mouse", pcb: "PCB" };
    const COLS = { battery: "#184e77", keyboard: "#52b69a", mobile: "#99d98c", mouse: "#e0b13a", pcb: TERRA };
    const range = i => { const v = E.tsne.map(p => p[i]); return [Math.min(...v), Math.max(...v)]; };
    const R = [0, 1, 2, 3].map(range);
    const sx = (v, r) => 20 + 440 * (v - r[0]) / (r[1] - r[0]), sy = (v, r) => 380 - 356 * (v - r[0]) / (r[1] - r[0]);
    const ms = { raw: [], cmre: [] }, ls = { raw: [], cmre: [] };
    // per class: the line joins the Kaan centre to the Bangladesh centre; shorter after CMRE means the two sources moved together
    const gap = {};
    const cen = (c, s, o) => { const q = E.tsne.filter(p => p[4] === c && p[5] === s); return [q.reduce((a, p) => a + p[o], 0) / q.length, q.reduce((a, p) => a + p[o + 1], 0) / q.length]; };
    const order = E.tsne.map((p, i) => i).sort((a, b) => (E.tsne[a][5] === "kaan" ? 0 : 1) - (E.tsne[b][5] === "kaan" ? 0 : 1));
    [["raw", $("tsRaw"), 0], ["cmre", $("tsCmre"), 2]].forEach(([key, svg, o]) => {
      el("rect", { x: .5, y: .5, width: 479, height: 399, rx: 16, fill: "none", stroke: LINE }, svg);
      order.forEach(i => { const p = E.tsne[i], x = sx(p[o], R[o]), y = sy(p[o + 1], R[o + 1]);
        const m = p[5] === "kaan" ? el("circle", { cx: x, cy: y, r: 3, fill: COLS[p[4]], "fill-opacity": .7 }, svg)
                                  : el("path", { d: `M${x} ${y - 4.5}l4 7h-8z`, fill: COLS[p[4]], "fill-opacity": .95, stroke: "#fff", "stroke-width": .8 }, svg);
        m.dataset.cls = p[4]; m.dataset.src = p[5]; ms[key].push(m); });
      Object.keys(NAMES).forEach(c => {
        const pts = E.tsne.filter(p => p[4] === c).map(p => [sx(p[o], R[o]), sy(p[o + 1], R[o + 1])]);
        const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const [lx, ly] = pts.reduce((b, p) => Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(b[0] - mx, b[1] - my) ? p : b);
        const t = txt(svg, Math.max(30, Math.min(450, lx)), Math.max(16, ly - 10), NAMES[c], { "text-anchor": "middle", class: "strong", "paint-order": "stroke", stroke: "#fff", "stroke-width": 4, "stroke-linejoin": "round" });
        t.dataset.cls = c; ls[key].push(t);
      });
      Object.keys(NAMES).forEach(c => { const [ax, ay] = cen(c, "kaan", o), [bx, by] = cen(c, "bangla", o);
        const g = el("g", {}, svg); g.dataset.cls = c; ls[key].push(g);
        el("line", { x1: sx(ax, R[o]), y1: sy(ay, R[o + 1]), x2: sx(bx, R[o]), y2: sy(by, R[o + 1]), stroke: INK, "stroke-width": 2, "stroke-dasharray": "5 4" }, g);
        [[ax, ay, SRCCOL.kaan], [bx, by, SRCCOL.bangla]].forEach(([x, y, f]) => el("circle", { cx: sx(x, R[o]), cy: sy(y, R[o + 1]), r: 6, fill: f, stroke: INK, "stroke-width": 2 }, g));
        (gap[c] = gap[c] || {})[key] = Math.hypot((ax - bx) / (R[o][1] - R[o][0]), (ay - by) / (R[o + 1][1] - R[o + 1][0])); });
      svg.setAttribute("aria-label", `t-SNE ${key === "raw" ? "sebelum" : "sesudah"} CMRE: warna = kelas, bentuk = sumber foto`);
    });
    $("tsRawSub").innerHTML = `Consistency <b>${fmt(bdc.raw, 2)}</b>`;
    $("tsCmreSub").innerHTML = `Consistency <b>${fmt(bdc.cmre, 2)}</b>`;
    const shorter = () => { const k = Object.keys(NAMES), s = k.filter(c => gap[c].cmre < gap[c].raw), n = k.filter(c => !s.includes(c));
      return `garisnya memendek pada ${s.length} dari ${k.length} kelas (${s.map(c => (c === "pcb" ? NAMES[c] : NAMES[c].toLowerCase())).join(", ")})` + (n.length ? `, tetapi tidak pada ${n.map(c => (c === "pcb" ? NAMES[c] : NAMES[c].toLowerCase())).join(", ")}` : ""); };
    $("tsSub").textContent = `${E.tsne.length.toLocaleString("id-ID")} foto, satu titik satu foto. Cara membaca: dengan warna sumber, sebelum CMRE titik oranye (Bangladesh) menggerombol sendiri, terpisah dari titik biru (Kaan) walau barangnya sama. Sesudah CMRE, keduanya lebih dekat. Garis putus-putus menghubungkan pusat titik Kaan dan pusat titik Bangladesh untuk tiap kelas: ${shorter(true)}.`;
    const box = $("tsClass");
    const pickClass = c => { box.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.c === c));
      ["raw", "cmre"].forEach(k => { ms[k].forEach(m => m.style.opacity = c === "all" || m.dataset.cls === c ? 1 : .07); ls[k].forEach(t => t.style.opacity = c === "all" || t.dataset.cls === c ? 1 : 0); }); };
    [["all", "Semua kelas"], ...Object.entries(NAMES)].forEach(([c, l]) => { const b = document.createElement("button"); b.type = "button"; b.dataset.c = c; b.textContent = l; if (COLS[c]) b.style.setProperty("--class-color", COLS[c]); b.onclick = () => pickClass(c); box.appendChild(b); });
    pickClass("all");
    // source colour shows the before/after story at a glance; class colour shows whether same-class photos end up together
    const paintTs = mode => { $("tsColor").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === mode));
      ["raw", "cmre"].forEach(k => ms[k].forEach(m => m.setAttribute("fill", mode === "src" ? SRCCOL[m.dataset.src] : COLS[m.dataset.cls])));
      $("tsKey").innerHTML = (mode === "src" ? `<span><i class="sw" style="background:${SRCCOL.kaan}"></i>Kaan · foto katalog</span><span><i class="sw" style="background:${SRCCOL.bangla}"></i>Bangladesh · foto objek</span>`
        : Object.entries(NAMES).map(([c, l]) => `<span><i class="sw" style="background:${COLS[c]}"></i>${l}</span>`).join("")) + `<span><i class="sw dot source"></i>lingkaran = Kaan</span><span><i class="sw tri"></i>segitiga = Bangladesh</span>`; };
    $("tsColor").querySelectorAll("button").forEach(b => b.onclick = () => paintTs(b.dataset.mode));
    paintTs("src");
  })();

  // ================= ANALISIS: BUKTI =================
  $("headline").innerHTML = `
    <p class="kicker">Data BDC · K = 16</p>
    <div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:16px 48px">
      <div><span class="muted" style="font-size:14px">Raw fusion</span><div class="num" style="font-size:52px;font-weight:600;line-height:1.05">${fmt(bdc.raw, 3)}</div></div>
      <div><span class="muted" style="font-size:14px">CMRE</span><div class="num" style="font-size:52px;font-weight:600;line-height:1.05">${fmt(bdc.cmre, 3)}</div><span class="muted" style="font-size:13px">CI 95%: ${bdc.ci}</span></div>
      <div><span class="muted" style="font-size:14px">Shubha, diuji setelah metode di-freeze</span><div class="num" style="font-size:52px;font-weight:600;line-height:1.05">${fmt(shubha.raw, 2)} → ${fmt(shubha.cmre, 2)}</div></div>
    </div>
    <p style="margin-top:16px;max-width:70ch">INLP dengan style proxy buatan peneliti juga mencapai ${fmt(bdc.inlp, 3)} di BDC, tetapi butuh label style. Di Office-Home, yang source bias-nya kecil, CMRE tidak mengubah hasil (${fmt(oh.raw, 3)} dan ${fmt(oh.cmre, 3)}).</p>`;
  const METHODS = [["raw", "Raw fusion"], ["dino", "DINOv3 saja"], ["inlp", "INLP ×3"], ["light", "CMRE light"], ["fast", "CMRE fast"], ["cmre", "CMRE"]];
  const parseCI = s => s ? s.split(" sampai ").map(v => +v.replace(",", ".")) : null;
  E.datasets.forEach(d => {
    const box = document.createElement("div"); box.className = "dataset-card";
    box.innerHTML = `<p class="ctitle">${d.name}</p><p class="csub" style="margin-bottom:8px">${d.role} · ${d.n.toLocaleString("id-ID")} foto</p>`;
    const wrap = document.createElement("div"); wrap.className = "chart-scroll dataset-chart";
    const svg = el("svg", { class: "chart", role: "img", "aria-label": `Consistency per metode, ${d.name}` }, wrap);
    box.appendChild(wrap); $("dsGrid").appendChild(box);
    fit(svg, 420, dots(svg, METHODS.map(([k, l]) => ({ label: l, value: d[k], focus: k === "cmre", ci: k === "cmre" ? parseCI(d.ci) : null,
      tip: `<b>${l}</b> · ${d.name}<br>consistency ${d[k] == null ? "tidak tersedia" : fmt(d[k])}${k === "inlp" ? "<br>memakai style proxy" : ""}` })),
      { W: 420, left: 125, right: 60, rowH: 32, min: .3, max: 1, ticks: [.3, .5, .7, .9, 1], valueFmt: v => v == null ? "–" : fmt(v, 3) }));
  });
  table("dsTbl", ["Metode", ...E.datasets.map(d => d.name)], METHODS.map(([k, l]) => [l, ...E.datasets.map(d => d[k] ?? "–")]));
  (() => {
    const USED = ["DINOv3-H+", "PE-Core-G", "SigLIP2-So400m"], palette = ["#b5e48c", "#76c893", "#34a0a4", "#1a759f", "#184e77"];
    const FAM = { ssl: "Tanpa teks", sup: "Berlabel (ImageNet-22k)", vlm: "Vision-language" };
    const ranked = [...E.backbones].sort((a, b) => b.xsrc - a.xsrc), low = Math.min(...ranked.map(b => b.xsrc)), span = Math.max(...ranked.map(b => b.xsrc)) - low || 1;
    const svg = $("bbChart"), h = hbars(svg, ranked.map(b => ({ label: b.name.replace(" (IN-22k)", "") + (USED.includes(b.name) ? " *" : ""), value: b.xsrc,
      color: palette[Math.round((b.xsrc - low) / span * (palette.length - 1))], focus: USED.includes(b.name), tip: `<b>${b.name}</b> · ${FAM[b.fam]}<br>consistency ${fmt(b.xsrc)}` })), { W: 760, left: 190, right: 58, rowH: 28, barH: 14 });
    txt(svg, 190, h + 6, "* dipakai di pipeline usulan", {}); fit(svg, 760, h + 14);
    table("bbTbl", ["Model", "Jenis", "Consistency"], ranked.map(b => [b.name, FAM[b.fam], b.xsrc]));
  })();
  const pctTick = v => Math.round(v * 100) + "%", oi = E.oodSummary.iliev;
  $("oodSummary").innerHTML = `
    <div class="card"><p class="kicker">Iliev · development set</p><p class="label">AUROC</p><div class="value">${fmt(oi.auc, 3)}</div><p class="detail">${oi.n.toLocaleString("id-ID")} foto. Data ini ikut dipakai memilih hyperparameter alarm.</p></div>
    <div class="card"><p class="kicker">Shubha · diuji setelah metode di-freeze</p><p class="label">AUROC</p><div class="value">${fmt(os.auc, 3)}</div><p class="detail">${os.n} foto. Ditandai: ${pct(os.in_flag)} foto yang dikenal dan ${pct(os.out_flag)} foto barang asing.</p></div>`;
  [["oodKnown", true, "Barang yang ada di BDC"], ["oodNew", false, "Barang di luar BDC"]].forEach(([id, known, title]) => {
    const svg = $(id), rows = E.ood.filter(o => o.known === known).sort((a, b) => b.flag - a.flag);
    txt(svg, 0, 14, title, { class: "strong" });
    fit(svg, 440, hbars(svg, rows.map(o => ({ label: o.label, value: o.flag, focus: !known, tip: `<b>${o.label}</b> · ${o.dataset}<br>${pct(o.flag)} ditandai dari ${o.n} foto` })),
      { W: 440, left: 130, right: 52, rowH: 28, barH: 14, dy: 22, ticks: [0, .5, 1], tickFmt: pctTick, valueFmt: pct }));
    svg.setAttribute("aria-label", `${title}: proporsi foto yang ditandai`);
  });
  table("oodTbl", ["Kategori", "Dataset", "Ada di BDC", "Foto", "Ditandai"], E.ood.map(o => [o.label, o.dataset, o.known ? "ya" : "tidak", String(o.n), pct(o.flag)]));
  const OS = E.oodSources, OSRC = [["kaan", "Kaan"], ["bangla", "Bangladesh"], ["karan", "Karan"], ["giz", "GIZ"]].sort((a, b) => OS[b[0]].flag - OS[a[0]].flag);
  fit($("oodSrc"), 440, hbars($("oodSrc"), OSRC.map(([k, l]) => ({ label: l, value: OS[k].flag, focus: k === "giz", tip: `<b>${l}</b><br>${pct(OS[k].flag)} ditandai dari ${OS[k].n.toLocaleString("id-ID")} foto` })),
    { W: 440, left: 110, right: 52, rowH: 32, barH: 16, ticks: [0, .5, 1], tickFmt: pctTick, valueFmt: pct }));
  table("srcTbl", ["Sumber", "Foto", "Ditandai"], OSRC.map(([k, l]) => [l, String(OS[k].n), pct(OS[k].flag)]));
  function lineChart(svg, pts, series, { xs, xmin, xmax, xlog, band, mark: mk, dots: dd, xname }) {
    const L = 40, Rt = 324, Tp = 14, Bm = 200, ymin = .4;
    const X = v => L + (Rt - L) * (xlog ? (Math.log2(v) - Math.log2(xmin)) / (Math.log2(xmax) - Math.log2(xmin)) : (v - xmin) / (xmax - xmin));
    const Y = v => Bm - (Bm - Tp) * (v - ymin) / (1 - ymin);
    if (band) el("rect", { x: X(band[0]), y: Tp, width: X(band[1]) - X(band[0]), height: Bm - Tp, fill: "#f2f3f5" }, svg);
    [.4, .6, .8, 1].forEach(v => { el("line", { x1: L, x2: Rt, y1: Y(v), y2: Y(v), class: v === ymin ? "base" : "grid" }, svg); txt(svg, L - 8, Y(v) + 4, fmt(v, 1), { "text-anchor": "end", class: "num" }); });
    xs.forEach(v => txt(svg, X(v), Bm + 18, v, { "text-anchor": "middle", class: "num" }));
    if (mk) { el("line", { x1: X(mk[0]), x2: X(mk[0]), y1: Tp, y2: Bm, stroke: INK, "stroke-width": 1 }, svg); txt(svg, X(mk[0]) + 5, Tp + 10, mk[1], { class: "ink" }); }
    series.forEach(([key, col]) => {
      el("path", { d: pts.map((p, i) => `${i ? "L" : "M"}${X(p.x)} ${Y(p[key])}`).join(" "), fill: "none", stroke: col, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      pts.forEach(p => el("circle", { cx: X(p.x), cy: Y(p[key]), r: 2.5, fill: col }, svg));
    });
    let h = Bm + 30;
    if (dd) { const c = {}; dd.forEach(k => { c[k] = (c[k] || 0) + 1; el("circle", { cx: X(k), cy: Bm + 34 + (c[k] - 1) * 11, r: 4, fill: FOCUS, stroke: "#fff", "stroke-width": 1.5 }, svg); });
      txt(svg, L - 8, Bm + 38, "SCMax", { "text-anchor": "end" }); h = Bm + 34 + 2 * 11 + 12; }
    const cross = el("line", { y1: Tp, y2: Bm, stroke: INK, "stroke-width": 1, opacity: 0 }, svg);
    const ring = series.map(([, col]) => el("circle", { r: 5, fill: col, stroke: "#fff", "stroke-width": 2, opacity: 0 }, svg));
    const hit = el("rect", { x: L - 10, y: Tp, width: Rt - L + 20, height: Bm - Tp, fill: "transparent", tabindex: 0, "aria-label": "Geser dengan panah kiri atau kanan untuk membaca nilai" }, svg);
    const tipFor = p => `<b>${xname} = ${p.x}</b><br>${series.map(([k, , l]) => `${l} ${fmt(p[k])}`).join("<br>")}`;
    const focusPt = (p, cx, cy) => { cross.setAttribute("x1", X(p.x)); cross.setAttribute("x2", X(p.x)); cross.setAttribute("opacity", .3);
      series.forEach(([k], i) => { ring[i].setAttribute("cx", X(p.x)); ring[i].setAttribute("cy", Y(p[k])); ring[i].setAttribute("opacity", 1); }); showTip(tipFor(p), cx, cy); };
    const off = () => { cross.setAttribute("opacity", 0); ring.forEach(r => r.setAttribute("opacity", 0)); hideTip(); };
    const toClient = v => { const b = svg.getBoundingClientRect(); return b.left + v * b.width / svg.viewBox.baseVal.width; };
    hit.addEventListener("mousemove", e => { const b = svg.getBoundingClientRect(), cx = (e.clientX - b.left) * svg.viewBox.baseVal.width / b.width;
      focusPt(pts.reduce((a, p) => Math.abs(X(p.x) - cx) < Math.abs(X(a.x) - cx) ? p : a), e.clientX, e.clientY); });
    hit.addEventListener("mouseleave", off); hit.addEventListener("blur", off);
    let ki = 0; hit.addEventListener("keydown", e => { const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return; e.preventDefault();
      ki = Math.max(0, Math.min(pts.length - 1, ki + d)); focusPt(pts[ki], toClient(X(pts[ki].x)), svg.getBoundingClientRect().top + 30); });
    fit(svg, 340, h);
  }
  lineChart($("kChart"), E.robust.k.map(p => ({ x: p.K, xsrc: p.xsrc, purity: p.purity })), [["purity", CONTEXT, "purity"], ["xsrc", FOCUS, "consistency"]],
            { xs: [8, 12, 16, 20, 24], xmin: 8, xmax: 24, mark: [16, "K = 16"], dots: E.robust.scmax, xname: "K" });
  table("kTbl", ["K", "Consistency", "Purity BDC"], E.robust.k.map(p => [String(p.K), p.xsrc, p.purity]));
  lineChart($("rChart"), E.robust.r.map(p => ({ x: p.r, xsrc: p.xsrc })), [["xsrc", FOCUS, "consistency"]],
            { xs: [4, 8, 16, 32, 64, 128, 256], xmin: 4, xmax: 256, xlog: true, band: [16, 64], mark: [64, "r = 64"], xname: "r" });
  table("rTbl", ["r", "Consistency"], E.robust.r.map(p => [String(p.r), p.xsrc]));
  fit($("aChart"), 340, hbars($("aChart"), E.robust.algo.map((a, i) => ({ label: a.name.replace(" (usulan)", ""), value: a.xsrc, focus: !i, tip: `<b>${a.name}</b><br>consistency ${fmt(a.xsrc)}<br>purity ${fmt(a.purity)}` })),
    { W: 340, left: 76, right: 48, rowH: 44, barH: 16, ticks: [0, .5, 1], tickFmt: v => fmt(v, 1) }));
  table("aTbl", ["Algoritma", "Consistency", "Purity", "Silhouette"], E.robust.algo.map(a => [a.name, a.xsrc, a.purity, a.sil]));
  const X8 = E.extra, sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v));
  fit($("blChart"), 420, hbars($("blChart"), X8.baselines.map((b, i) => ({ label: b.name.replace(" (usulan)", ""), value: b.xsrc, focus: !i,
    tip: `<b>${b.name}</b><br>BDC ${fmt(b.xsrc)} · Iliev ${fmt(b.iliev)} · Shubha ${fmt(b.shubha)}<br>cakupan ${pct(b.coverage)}` })),
    { W: 420, left: 90, right: 52, rowH: 40, barH: 16, ticks: [0, .5, 1], tickFmt: v => fmt(v, 1) }));
  table("blTbl", ["Metode", "BDC", "Iliev", "Shubha", "Stability", "Cakupan"], X8.baselines.map(b => [b.name, b.xsrc, b.iliev, b.shubha, b.ari, pct(b.coverage)]));
  fit($("refChart"), 420, hbars($("refChart"), X8.refs.map(r => ({ label: r.name.replace(" (supervisi)", "").replace(" (v4)", " (usulan)"), value: r.xsrc, focus: r.name.includes("(v4)"),
    tip: `<b>${r.name}</b><br>R² ${fmt(r.r2)}<br>raw ${fmt(r.raw)} → CMRE ${fmt(r.xsrc)}${r.ssl ? "" : "<br>reference supervised"}` })),
    { W: 420, left: 150, right: 52, rowH: 28, barH: 14, ticks: [0, .5, 1], tickFmt: v => fmt(v, 1) }));
  table("refTbl", ["Reference model", "R²", "Raw", "CMRE"], X8.refs.map(r => [r.name, r.r2, r.raw, r.xsrc]));
  table("prTbl", ["Baseline", "BDC", "Iliev", "Shubha"], X8.paired.map(p => [p.vs, ...["BDC", "Iliev", "Shubha"].map(d => `${sgn(p[d][0])} [${sgn(p[d][1])}; ${sgn(p[d][2])}]`)]), true);
  const nt = X8.notest, sp = X8.speed, fast = E.datasets.map(d => d.fast).filter(v => v != null);
  $("ntCard").innerHTML = `<p class="kicker">Tanpa 188 foto test set</p><h3>Consistency tetap ${fmt(nt.bdc)}</h3>
    <p class="muted">Pipeline dijalankan ulang dengan 3.604 foto train saja. Iliev ${fmt(nt.iliev)}, Shubha ${fmt(nt.shubha)}. Pembagian cluster hampir sama: ARI ${fmt(nt.ari_train, 2)} pada foto train.</p>`;
  $("fastCard").innerHTML = `<p class="kicker">Versi cepat tanpa PE-Core-G</p><h3>${fmt(sp.fast / sp.full, 0)}× lebih cepat</h3>
    <p class="muted">Sekitar ${fmt(sp.fast, 0)} foto per detik pada GPU L4 (alur penuh ${fmt(sp.full, 1)}). Consistency ${fast.map(v => fmt(v, 3)).join(" · ")} (BDC · Iliev · Shubha), turun 0,02 sampai 0,03.</p>`;
  (() => {
    const S = E.scen, MUTED = "#4b6170";
    const scBars = (id, rows, max = 1) => {
      const svg = $(id); svg.innerHTML = "";
      const W = 560, L = 178, R = 60, H = rows.length * 34 + 30, x = v => L + v / max * (W - L - R);
      fit(svg, W, H);
      [0, max / 2, max].forEach(t => { el("line", { x1: x(t), x2: x(t), y1: 4, y2: H - 22, stroke: LINE }, svg); txt(svg, x(t), H - 6, fmt(t, 2), { "text-anchor": "middle", "font-size": 12, fill: MUTED }); });
      rows.forEach((r, i) => {
        const y = 8 + i * 34, w = Math.max(1, x(r.value) - L);
        txt(svg, L - 10, y + 20, r.name, { "text-anchor": "end", "font-size": 14, fill: INK });
        const bar = el("path", { d: hbarPath(L, y + 6, w, 20), fill: r.focus ? FOCUS : CONTEXT }, svg);
        txt(svg, L + w + 6, y + 21, fmt(r.value), { "font-size": 13, fill: INK });
        bindTip(bar, `<b>${r.name}</b><br>${r.tip || fmt(r.value)}`);
      });
    };
    const segs = (host, opts, cur, onPick) => { const box = $(host); box.innerHTML = "";
      opts.forEach(([key, label]) => { const b = document.createElement("button"); b.className = "btn"; b.type = "button"; b.textContent = label; b.setAttribute("aria-pressed", key === cur);
        b.onclick = () => { box.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); onPick(key); }; box.appendChild(b); }); };
    const bb = [...E.backbones].sort((a, b) => b.xsrc - a.xsrc);
    scBars("scS1", bb.map(b => ({ name: b.name, value: b.xsrc, focus: b.name === "DINOv3-H+", tip: `consistency ${fmt(b.xsrc)}` })));
    table("scS1t", ["Model", "Consistency"], bb.map(b => [b.name, b.xsrc]));
    let ds = "BDC", met = "xsrc";
    const drawS2 = () => { const rows = S.s2[ds], c = S.s2[ds + "_ci"], isLeak = met === "leak";
      $("scS2title").textContent = `${isLeak ? "Source leakage" : "Cross-source consistency"} pada ${ds}`;
      $("scS2sub").textContent = isLeak ? "Lebih kecil lebih baik." : "Lebih besar lebih baik.";
      scBars("scS2", rows.map(r => ({ name: r.name, value: r[met], focus: r.name.startsWith("CMRE"), tip: `consistency ${fmt(r.xsrc)} · leakage ${fmt(r.leak)}` })), isLeak ? Math.max(.4, Math.ceil(Math.max(...rows.map(r => r.leak)) * 10) / 10) : 1);
      table("scS2t", ["Cara", "Consistency", "Leakage"], rows.map(r => [r.name, r.xsrc, r.leak]));
      $("scS2ci").textContent = `Selisih EPO dikurangi CMRE pada ${ds}: ${fmt(c[0])} (CI 95% ${fmt(c[1])} sampai ${fmt(c[2])}). ` + (c[1] > 0 ? "EPO lebih tinggi di data ini." : "CMRE setara atau lebih tinggi di data ini."); };
    segs("scS2ds", [["BDC", "BDC"], ["Iliev", "Iliev"], ["Shubha", "Shubha"]], ds, k => { ds = k; drawS2(); });
    segs("scS2m", [["xsrc", "Consistency"], ["leak", "Source leakage"]], met, k => { met = k; drawS2(); });
    drawS2();
    const IN = S.s2.inlp;
    $("scS2inlp").textContent = `INLP dengan style proxy buatan peneliti mencapai ${fmt(IN.researcher)} di BDC, sama dengan CMRE. Dengan proxy otomatis, INLP hanya ${fmt(IN.auto2)}, sedangkan CMRE ${fmt(IN.cmre2)} pada fusion model yang sama tanpa proxy.`;
    let m3 = "xsrc";
    const rg = (lo, v) => lo ? `${fmt(lo)}–${fmt(v)}` : fmt(v);
    const drawS3 = () => { const nm = m3 === "nmi", rows = [...S.s3].sort((a, b) => b[m3] - a[m3]);
      $("scS3title").textContent = `${nm ? "Kecocokan label kelas (NMI)" : "Cross-source consistency"} per algoritma`;
      scBars("scS3", rows.map(a => ({ name: a.name, value: a[m3], focus: a.name.startsWith("Spectral"), tip: `consistency ${rg(a.lo, a.xsrc)} · NMI ${rg(a.nmi_lo, a.nmi)}${a.coverage && a.coverage < 1 ? ` · cakupan ${pct(a.coverage)}` : ""}` })));
      table("scS3t", ["Algoritma", "Cluster", "Consistency", "NMI"], rows.map(a => [a.name, a.group, rg(a.lo, a.xsrc), rg(a.nmi_lo, a.nmi)])); };
    segs("scS3m", [["xsrc", "Consistency"], ["nmi", "NMI"]], m3, k => { m3 = k; drawS3(); });
    drawS3();
    table("scS4t", ["Hyperparameter", "Nilai", "Consistency BDC"], [["r (direction dibuang)", "16–64", "0,97–0,99"], ["r", "4", "0,449"], ["r", "128", "0,821"],
      ["α ridge", "0,01–1", "0,975–0,983"], ["k-NN graph", "15–30", "0,975–0,988"], ["k-NN graph", "5–10", "sekitar 0,91"]], true);
    table("scS5picks", ["Fitur", "Silhouette", "Eigengap", "PAC"], S.picks.map(p => [p.feat, String(p.silhouette), String(p.eigengap), String(p.PAC)]), true);
    const VM = [["top1_micro", "Top-1 mikro"], ["top1_macro", "Top-1 makro"], ["mrr", "MRR"], ["auroc", "AUROC alarm"], ["auprc", "AUPRC alarm"]];
    let vm = "top1_macro";
    const drawV = () => { const lab = VM.find(v => v[0] === vm)[1], ood = vm.startsWith("au");
      $("scVtitle").textContent = `${lab}, dataset Bangladesh lengkap`;
      $("scVsub").textContent = ood ? "1.443 foto nonelektronik vs 710 foto lima kelas. Menebak acak = 0,5 untuk AUROC." : vm === "mrr" ? "710 foto lima kelas. Nilai acak 0,457." : "710 foto lima kelas. Nilai acak 0,20.";
      scBars("scV", S.val.map(v => ({ name: v.name, value: v[vm], focus: v.name.startsWith("CMRE"), tip: VM.map(m => `${m[1]} ${fmt(v[m[0]])}`).join("<br>") }))); };
    segs("scVm", VM, vm, k => { vm = k; drawV(); });
    drawV();
    table("scVt", ["Metode", ...VM.map(v => v[1])], S.val.map(v => [v.name, ...VM.map(m => v[m[0]])]));
    const tabs = [...root.querySelectorAll("#skenario [role=tab]")];
    const pickTab = (i, focus) => tabs.forEach((t, j) => { const on = i === j; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; $(t.getAttribute("aria-controls")).hidden = !on; if (on && focus) t.focus(); });
    tabs.forEach((t, i) => { t.onclick = () => pickTab(i);
      t.onkeydown = e => { const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]; if (n != null) { e.preventDefault(); pickTab((n + tabs.length) % tabs.length, true); } }; });
  })();

  // ================= GRAPH kNN: the graph spectral clustering cuts (graph.js), K = 16 vs 17, one panel per cluster =================
  (() => {
    const G = window.GRAPH;
    if (!G) { $("gCap").textContent = "Data graph (graph.js) tidak termuat."; return; }
    const P = E.clusterMap, N = P.length, raw = atob(G.edges), u8 = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
    const ed = new Uint16Array(u8.buffer), M = ed.length / 2, wt = e => e < G.nMutual ? 1 : .5;  // mutual edges come first
    const L16 = P.map(p => p[2]), L17 = G.k17, NEW = 16, CUT = "#d64545", NEWCOL = "#7a5195", OTHER = "#c3cfd4";
    const num = v => v.toLocaleString("id-ID");
    const col = c => c === NEW ? NEWCOL : CATCOLORS[C[c].cat];
    const deg = new Uint16Array(N);
    for (let e = 0; e < M; e++) { deg[ed[2 * e]]++; deg[ed[2 * e + 1]]++; }

    // per-cluster cut statistics; conductance = cut weight / volume (sum of weighted degrees), as in the normalized cut
    const stats = (L, K) => {
      const cl = Array.from({ length: K }, () => ({ n: 0, inner: 0, cut: 0, wIn: 0, wCut: 0, to: new Map() }));
      L.forEach(c => cl[c].n++);
      for (let e = 0; e < M; e++) {
        const a = L[ed[2 * e]], b = L[ed[2 * e + 1]], w = wt(e);
        if (a === b) { cl[a].inner++; cl[a].wIn += w; continue; }
        for (const [p, q] of [[a, b], [b, a]]) { cl[p].cut++; cl[p].wCut += w; cl[p].to.set(q, (cl[p].to.get(q) || 0) + 1); }
      }
      cl.forEach(c => { c.cond = c.wCut / (2 * c.wIn + c.wCut); c.top = [...c.to].sort((x, y) => y[1] - x[1])[0]; });
      const cut = cl.reduce((s, c) => s + c.cut, 0) / 2, conds = cl.map(c => c.cond);
      return { cl, cut, kept: M - cut, mean: conds.reduce((s, v) => s + v, 0) / K, max: Math.max(...conds) };
    };
    const S16 = stats(L16, 16), S17 = stats(L17, 17);

    // canvas painter: data box -> logical canvas, equal x/y scale (t-SNE has no preferred axis); edges batched by colour
    const setup = cv => { const W = +cv.getAttribute("width"), H = +cv.getAttribute("height"), r = Math.min(2, devicePixelRatio || 1);
      cv.width = W * r; cv.height = H * r; const ctx = cv.getContext("2d"); ctx.scale(r, r); return { cv, ctx, W, H }; };
    // q trims t-SNE outliers (a few members sit far from their cluster) so the dense core fills the panel
    const boxOf = (ids, pad = .06, q = 0) => { const xs = ids.map(i => P[i][0]).sort((a, b) => a - b), ys = ids.map(i => P[i][1]).sort((a, b) => a - b);
      const lo = Math.floor(q * (ids.length - 1)), hi = Math.ceil((1 - q) * (ids.length - 1));
      const x0 = xs[lo], x1 = xs[hi], y0 = ys[lo], y1 = ys[hi], px = (x1 - x0) * pad || 1, py = (y1 - y0) * pad || 1;
      return [x0 - px, x1 + px, y0 - py, y1 + py]; };
    const paint = (c, box, edges, nodes) => {
      const { ctx, W, H } = c, [a, b, y0, y1] = box, s = Math.min(W / (b - a), H / (y1 - y0)), ox = (W - s * (b - a)) / 2, oy = (H - s * (y1 - y0)) / 2;
      const X = i => ox + s * (P[i][0] - a), Y = i => H - oy - s * (P[i][1] - y0);
      c.X = X; c.Y = Y; ctx.clearRect(0, 0, W, H);
      for (const { list, color, alpha, lw } of edges) {
        const by = new Map(); for (const e of list) { const k = color(e); (by.get(k) || by.set(k, []).get(k)).push(e); }
        ctx.globalAlpha = alpha; ctx.lineWidth = lw;
        for (const [k, es] of by) { ctx.strokeStyle = k; ctx.beginPath();
          for (const e of es) { const i = ed[2 * e], j = ed[2 * e + 1]; ctx.moveTo(X(i), Y(i)); ctx.lineTo(X(j), Y(j)); } ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      for (const { list, color, r } of nodes) for (const i of list) { ctx.fillStyle = color(i); ctx.beginPath(); ctx.arc(X(i), Y(i), r, 0, 7); ctx.fill(); }
    };
    const label = (c, ids, text) => {  // at the member closest to the cluster mean, white halo like the SVG maps
      const mx = ids.reduce((s, i) => s + c.X(i), 0) / ids.length, my = ids.reduce((s, i) => s + c.Y(i), 0) / ids.length;
      const i = ids.reduce((b, k) => Math.hypot(c.X(k) - mx, c.Y(k) - my) < Math.hypot(c.X(b) - mx, c.Y(b) - my) ? k : b);
      // 20 logical px: the 1000-px canvas renders at ~1/2 size on laptops and ~1/3 on phones
      const { ctx } = c; ctx.font = "700 20px 'Plus Jakarta Sans', sans-serif"; ctx.textAlign = "center"; ctx.lineJoin = "round";
      ctx.lineWidth = 6; ctx.strokeStyle = "#fff"; ctx.strokeText(text, c.X(i), c.Y(i) + 7); ctx.fillStyle = "#10293d"; ctx.fillText(text, c.X(i), c.Y(i) + 7);
    };
    const all = Array.from({ length: M }, (_, e) => e), ids = Array.from({ length: N }, (_, i) => i);
    const members = (L, K) => Array.from({ length: K }, (_, c) => ids.filter(i => L[i] === c));
    const M16 = members(L16, 16), M17 = members(L17, 17);
    const isCut = (L, e) => L[ed[2 * e]] !== L[ed[2 * e + 1]];

    // ---- 1. whole graph: uncut, cut at 16, cut at 17
    const full = setup($("gFull")), fullBox = boxOf(ids, .02);
    let mode = "16";
    const drawFull = m => {
      mode = m;
      root.querySelectorAll("#gMode [data-g]").forEach(b => b.setAttribute("aria-pressed", b.dataset.g === m));
      if (m === "full") {
        paint(full, fullBox, [{ list: all, color: () => CONTEXT, alpha: .12, lw: .6 }], [{ list: ids, color: () => "#6b7d87", r: 1.5 }]);
        $("gLegend").innerHTML = `<span><i class="sw" style="background:#6b7d87"></i>foto BDC (node)</span><span><i class="sw line" style="background:${CONTEXT}"></i>edge kNN</span>`;
        $("gCap").textContent = `Sebelum dipotong: ${num(N)} node dan ${num(M)} edge. ${num(G.nMutual)} edge (${pct(G.nMutual / M)}) dua arah, sisanya satu arah.`;
      } else {
        const L = m === "16" ? L16 : L17, K = +m, S = m === "16" ? S16 : S17;
        paint(full, fullBox, [{ list: all.filter(e => !isCut(L, e)), color: e => col(L[ed[2 * e]]), alpha: .22, lw: .6 }, { list: all.filter(e => isCut(L, e)), color: () => CUT, alpha: .5, lw: .8 }],
          [{ list: ids, color: i => col(L[i]), r: 1.7 }]);
        (m === "16" ? M16 : M17).forEach((ms, c) => label(full, ms, c === NEW ? "ke-17" : `C${c}`));
        $("gLegend").innerHTML = [...new Set(C.map(c => c.cat))].map(k => `<span><i class="sw" style="background:${CATCOLORS[k]}"></i>${CATNAME[k]}</span>`).join("") +
          (K === 17 ? `<span><i class="sw" style="background:${NEWCOL}"></i>cluster ke-17</span>` : "") + `<span><i class="sw line" style="background:${CUT}"></i>edge terpotong</span>`;
        $("gCap").textContent = `Dipotong menjadi ${K} cluster: ${num(S.kept)} edge (${pct(S.kept / M)}) tetap di dalam cluster, ${num(S.cut)} edge terpotong (merah).`;
      }
      const S = mode === "17" ? S17 : S16;
      $("gStats").innerHTML = [["Node (foto BDC)", num(N), ""], ["Edge", num(M), `${num(G.nMutual)} dua arah · ${num(M - G.nMutual)} satu arah`],
        ["Edge per foto", fmt(2 * M / N, 1), "rata-rata derajat node"],
        ...(mode === "full" ? [] : [["Edge terpotong", num(S.cut), `${pct(S.cut / M)} dari semua edge`], ["Conductance rata-rata", fmt(S.mean), `terbesar ${fmt(S.max)}`]])]
        .map(([t, v, s]) => `<div><dt>${t}</dt><dd>${v}${s ? `<small>${s}</small>` : ""}</dd></div>`).join("");
    };
    root.querySelectorAll("#gMode [data-g]").forEach(b => b.onclick = () => drawFull(b.dataset.g));
    drawFull("16");
    table("gStatsT", ["K", "Edge di dalam cluster", "Edge terpotong", "Bagian edge terpotong", "Conductance rata-rata", "Conductance terbesar"],
      [[16, S16], [17, S17]].map(([k, S]) => [String(k), num(S.kept), num(S.cut), pct(S.cut / M), S.mean, S.max]));
    full.cv.addEventListener("mousemove", e => {
      const b = full.cv.getBoundingClientRect(), x = (e.clientX - b.left) * full.W / b.width, y = (e.clientY - b.top) * full.H / b.height;
      let best = -1, bd = 64;  // nearest node within 8 logical px
      for (let i = 0; i < N; i++) { const d = (full.X(i) - x) ** 2 + (full.Y(i) - y) ** 2; if (d < bd) { bd = d; best = i; } }
      if (best < 0) return hideTip();
      const c = (mode === "17" ? L17 : L16)[best];
      showTip(mode === "full" ? `<b>Satu foto BDC</b><br>${deg[best]} edge` : `<b>${c === NEW ? "Cluster ke-17" : `C${c} · ${C[c].name}`}</b><br>${deg[best]} edge dari foto ini`, e.clientX, e.clientY);
    });
    full.cv.addEventListener("mouseleave", hideTip);

    // ---- 2. K = 16 vs K = 17, zoomed on C15 and the photos that form the 17th cluster
    const zone = ids.filter(i => L16[i] === 15 || L17[i] === NEW), zset = new Set(zone), zBox = boxOf(zone, .08, .02);
    const touch = all.filter(e => zset.has(ed[2 * e]) || zset.has(ed[2 * e + 1]));
    const near = [...new Set(touch.flatMap(e => [ed[2 * e], ed[2 * e + 1]]))];
    const pair = (cv, L, colorOf) => { const c = setup($(cv)), cut = touch.filter(e => isCut(L, e));
      paint(c, zBox, [{ list: touch.filter(e => !isCut(L, e)), color: e => colorOf(ed[2 * e]), alpha: .25, lw: .7 }, { list: cut, color: () => CUT, alpha: .55, lw: .8 }],
        [{ list: near, color: colorOf, r: 2.1 }]);
      return cut.length; };
    const c16 = pair("gk16", L16, i => L16[i] === 15 ? FOCUS : OTHER), c17 = pair("gk17", L17, i => L17[i] === NEW ? NEWCOL : L17[i] === 15 ? FOCUS : OTHER);
    const from = [...M17[NEW].reduce((m, i) => m.set(L16[i], (m.get(L16[i]) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);
    const broke = all.filter(e => !isCut(L16, e) && isCut(L17, e)).length, joined = all.filter(e => isCut(L16, e) && !isCut(L17, e)).length;
    const k17s = E.scen.k17.find(k => k.k === 17), k16s = E.scen.k17.find(k => k.k === 16), top3 = from.slice(0, 3).map(([c, n]) => `C${c} (${n} foto)`);
    $("gkTitle").textContent = `Cluster ke-17 mengambil foto dari ${from.length} cluster, tidak hanya dari C15.`;
    $("gkLead").innerHTML = `Dari sisi graph, K = 17 tidak lebih buruk: edge yang terpotong ${num(S17.cut)}, sedikit lebih sedikit dari ${num(S16.cut)} pada K = 16.
      Bedanya ada pada isi cluster. ${num(M17[NEW].length)} foto cluster ke-17 terutama datang dari ${top3.slice(0, -1).join(", ")}, dan ${top3.at(-1)}: foto tumpukan dan area pengumpulan dengan background serupa.
      Pemotongan baru memutus ${num(broke)} edge yang pada K = 16 berada di dalam satu cluster, dan menyatukan ${num(joined)} edge yang tadinya terpotong.
      Jadi alasan memakai K = 16 bukan jumlah edge terpotong, melainkan stabilitas dan background bias (kaitan dengan gaya foto naik dari ${fmt(k16s.style, 2)} ke ${fmt(k17s.style, 2)}). Rinciannya ada di <a href="#/riset/k17">halaman 16 cluster</a>.`;
    $("gk16cap").textContent = `${num(c16)} edge terpotong menyentuh area ini. C15 berisi ${num(M16[15].length)} foto.`;
    $("gk17cap").textContent = `${num(c17)} edge terpotong menyentuh area ini. Sisa C15 ${num(M17[15].length)} foto, cluster ke-17 ${num(M17[NEW].length)} foto.`;
    table("gkT", ["Asal di K = 16", "Nama cluster", "Foto yang pindah ke cluster ke-17"], from.map(([c, n]) => [`C${c}`, C[c].name, String(n)]));

    // ---- 3. one panel per K = 16 cluster: inner edges in the cluster colour, cut edges in red to grey outside nodes
    const inner = Array.from({ length: 16 }, () => []), out = Array.from({ length: 16 }, () => []);
    for (let e = 0; e < M; e++) { const a = L16[ed[2 * e]], b = L16[ed[2 * e + 1]]; if (a === b) inner[a].push(e); else { out[a].push(e); out[b].push(e); } }
    const worst = S16.cl.reduce((b, s, c) => s.cond > S16.cl[b].cond ? c : b, 0);
    $("gcTitle").textContent = `${pct(S16.kept / M)} edge tetap di dalam cluster-nya. C${worst} paling banyak terhubung ke cluster lain.`;
    const host = $("gCards");
    C.forEach(cl => {
      const c = cl.id, s = S16.cl[c], b = document.createElement("button");
      b.className = "gcard"; b.type = "button";
      b.setAttribute("aria-label", `C${c} ${cl.name}: ${s.n} foto, ${s.inner} edge di dalam, ${s.cut} edge terpotong, conductance ${fmt(s.cond)}. Buka galeri`);
      b.innerHTML = `<canvas class="gcv" width="320" height="220" aria-hidden="true"></canvas><span class="t">C${c} · ${cl.name}</span>
        <span class="m num">${s.n} foto · ${num(s.inner)} edge di dalam · conductance ${fmt(s.cond)}</span>
        <span class="m num">${s.cut ? `${s.cut} edge terpotong, terbanyak ke C${s.top[0]} (${s.top[1]})` : "tidak ada edge terpotong"}</span>`;
      const outside = [...new Set(out[c].flatMap(e => [ed[2 * e], ed[2 * e + 1]]).filter(i => L16[i] !== c))];
      paint(setup(b.querySelector("canvas")), boxOf(M16[c], .12, .03),
        [{ list: inner[c], color: () => col(c), alpha: .35, lw: .7 }, { list: out[c], color: () => CUT, alpha: .6, lw: .8 }],
        [{ list: outside, color: () => "#9aa9b1", r: 1.8 }, { list: M16[c], color: () => col(c), r: 2 }]);
      b.onclick = () => openCluster(cl, b);
      host.appendChild(b);
    });
    table("gCardsT", ["Cluster", "Nama", "Foto", "Edge di dalam", "Edge terpotong", "Conductance", "Terbanyak ke"],
      C.map(cl => { const s = S16.cl[cl.id]; return [`C${cl.id}`, cl.name, String(s.n), num(s.inner), String(s.cut), s.cond, s.top ? `C${s.top[0]} (${s.top[1]})` : "–"]; }));
  })();

  // ================= ROUTER: six views, analysis sub-tabs, and in-page anchors =================
  const VIEWS = ["beranda", "coba", "kelompok", "graph", "cara-kerja", "analisis"];
  const subBtns = [...root.querySelectorAll(".subnav [data-sub]")];
  const showSub = s => { subBtns.forEach(b => { const on = b.dataset.sub === s; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
    root.querySelectorAll(".sub").forEach(p => p.hidden = p.dataset.sub !== s); };
  subBtns.forEach((b, i) => { b.onclick = () => { history.replaceState(null, "", "#/riset/analisis/" + b.dataset.sub); showSub(b.dataset.sub); };
    b.onkeydown = e => { const n = { ArrowRight: i + 1, ArrowLeft: i - 1 }[e.key]; if (n != null) { e.preventDefault(); const t = subBtns[(n + subBtns.length) % subBtns.length]; t.focus(); t.click(); } }; });
  function route() {
    const parts = (decodeURIComponent(location.hash.slice(1)).replace(/^\/+/, "") || "beranda").split("/");
    if (parts[0] === "riset") parts.shift();
    let [view, sub] = parts, target = null;
    if (!VIEWS.includes(view)) {
      target = root.getElementById(view);
      const host = target && target.closest(".view"); view = host ? host.dataset.view : "beranda";
      const s = target && target.closest(".sub"); if (s) sub = s.dataset.sub;
    }
    root.querySelectorAll(".view").forEach(v => v.hidden = v.dataset.view !== view);
    root.querySelectorAll("nav.views a").forEach(a => a.dataset.view === view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    if (view === "analisis") showSub(sub || "alur");
    if (view === "cara-kerja") cmre.start();
    hideTip();
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start" })); else scrollTo(0, 0);
    if (view === "beranda" && pendingFly) { const c = pendingFly; pendingFly = null; setTimeout(() => fly(c, null), 80); }
  }
  window.addEventListener("hashchange", route);
  route();
})();
