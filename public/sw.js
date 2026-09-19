const CACHE = "plot-scout-shell-v3";
const SHELL = ["/", "/manifest.webmanifest?v=3", "/plotscout-favicon-v2.png", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => undefined)); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then(r => { const copy=r.clone(); caches.open(CACHE).then(c=>c.put("/",copy)); return r; }).catch(()=>caches.match("/")));
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok && ["script","style","image","font"].includes(req.destination)) { const copy=r.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); } return r; })));
});
