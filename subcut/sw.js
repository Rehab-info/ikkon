// Sub-Cut: オフラインでも開けるようにする。中身を直したら VERSION を上げる。
const VERSION = "subcut-1";
const SHELL = ["./", "./index.html", "./style.css?v=1", "./services.js?v=1", "./detect.js?v=1", "./app.js?v=1", "./icon.svg", "./manifest.webmanifest", "./sample.csv"];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", ev => {
  ev.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("subcut-") && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  ev.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match("./"))));
});
