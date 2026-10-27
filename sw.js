// SENTRA service worker: network first for this site's files so updates show up, cache as offline fallback.
// Calls to the AI backend (another origin) are never cached.
const CACHE = "sentra-v39";
const SHELL = ["./", "index.html", "app.css", "app.js", "data.js", "manifest.webmanifest", "assets/logo.svg", "assets/mark.svg", "assets/bg-clusters.svg", "assets/icon-192.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request)));
});
