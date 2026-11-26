/* Service worker do Fingmusic: precache do app + cache em tempo de execução
 * do modelo de mãos (MediaPipe) para o modo câmera funcionar offline depois
 * do primeiro uso. Gerado no build a partir de src/sw-template.js. */
const VERSION = 'fingmusic-__VERSION__';
const PRECACHE = __PRECACHE__;
const RUNTIME = 'fingmusic-runtime-v1';
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'storage.googleapis.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== RUNTIME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // navegação: rede primeiro (pega versão nova), cai para o cache offline
    if (req.mode === 'navigate') { e.respondWith(fetch(req).catch(() => caches.match('/'))); return; }
    e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
    return;
  }
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(RUNTIME).then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
  }
});
