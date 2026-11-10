// Offline support: precache the whole app so it runs without a network.
// Bump VERSION whenever the file list changes.
const VERSION = 'v8';
const CACHE = 'yavalath-co-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'fonts/fraunces.woff2', 'fonts/figtree.woff2', 'vendor/three.js',
  'js/main.js', 'js/scene.js', 'js/hex.js', 'js/sound.js',
  'js/games/index.js', 'js/games/all.js', 'js/games/util.js',
  'js/games/yavalath.js', 'js/games/pentalath.js', 'js/games/yavalanchor.js', 'js/games/yavalade.js', 'js/games/cross.js',
  'js/games/omega.js', 'js/games/manalath.js', 'js/games/odd.js', 'js/games/coffee.js', 'js/games/ducks.js',
  'js/games/susan.js', 'js/games/taacoca.js', 'js/games/quantum.js', 'js/games/playwin.js', 'js/games/onager.js',
  'js/ai/worker.js', 'js/ai/mcts.js', 'js/ai/yavalath-ai.js',
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

// Network first, so a new release shows up on the next load; the cache is the
// fallback when offline.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        // 'no-cache' revalidates with the server, so the browser's own ten-minute
        // cache of the host's files cannot hold back a new release.
        const res = await fetch(request.url, { cache: 'no-cache' });
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return (await cache.match(request, { ignoreSearch: true })) || Response.error();
      }
    }),
  );
});
