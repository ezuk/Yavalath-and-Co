// Offline support: precache the app, then serve from cache while refreshing in
// the background. Bump VERSION whenever the file list changes.
const VERSION = 'v1';
const CACHE = 'yavalath-co-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'fonts/fraunces.woff2', 'fonts/figtree.woff2', 'vendor/three.js',
  'js/main.js', 'js/scene.js', 'js/hex.js',
  'js/games/index.js', 'js/games/yavalath.js', 'js/games/yavalath-tutorial.js',
  'js/ai/worker.js', 'js/ai/yavalath-ai.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request).then((res) => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    }),
  );
});
