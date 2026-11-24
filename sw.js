// Semangkuk Mie Ayam - service worker (offline penuh)
const VERSION = "mieayam-v7";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/level-1.webp",
  "./assets/level-10.webp",
  "./assets/level-11.webp",
  "./assets/level-2.webp",
  "./assets/level-3.webp",
  "./assets/level-4.webp",
  "./assets/level-5.webp",
  "./assets/level-6.webp",
  "./assets/level-7.webp",
  "./assets/level-8.webp",
  "./assets/level-9.webp",
  "./assets/logo-small.webp",
  "./assets/logo.webp",
  "./assets/rain-loop.mp3",
  "./assets/tok1.wav",
  "./assets/tok2.wav",
  "./assets/tok3.wav"
];
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;700;800;900&display=swap";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    // Simpan font sekalian agar tetap tampil saat offline
    try {
      const res = await fetch(FONT_CSS);
      const css = await res.clone().text();
      await c.put(FONT_CSS, res);
      const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
      await Promise.all(urls.map((u) => fetch(u).then((r) => c.put(u, r)).catch(() => {})));
    } catch (err) {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req); c.put(req, res.clone()); return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/analytics.html") return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./index.html", copy)); return res; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
});
