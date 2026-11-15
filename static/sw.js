// La app se abre SIEMPRE desde lo guardado en el celular (al instante, con o sin internet).
// Si hay internet, se actualiza por detras y la version nueva se ve la proxima vez.
const CACHE = 'offline-entertainment-v2';
const SHELL = ['./', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  const key = req.mode === 'navigate' ? './' : req;   // cualquier navegacion = la app
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(key, {ignoreSearch: true});
    const net = fetch(req).then(r => {
      // no guardar redirecciones ni paginas de portales wifi
      if (r.ok && !r.redirected && r.type === 'basic') c.put(key, r.clone());
      return r;
    });
    if (hit){ e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => c.match('./'));
  }));
});
