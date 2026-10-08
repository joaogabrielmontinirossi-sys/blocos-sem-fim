/* Blocos Sem Fim — service worker: guarda o app para abrir sem internet. */
const VERSION = 'blocos-sem-fim-1.0.0';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'sync.js', 'logo.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];
// A biblioteca 3D e as fontes vêm de fora; ficam guardadas na primeira visita.
const LIBS = ['https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Bibliotecas e fontes: cópia guardada primeiro (os endereços têm versão fixa).
  if (LIBS.includes(url.origin)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    })));
    return;
  }
  if (url.origin !== location.origin || url.pathname.includes('/api/')) return;
  // O app: rede primeiro (para receber atualizações), cópia guardada quando estiver sem internet.
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
