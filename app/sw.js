// Service Worker UNIKORA v7.0.31 — App Shell Offline + Cache de Assets JS/CSS Versionados + Web Push
const SW_VERSION = 'v7.0.31';
const SHELL_CACHE = 'unikora-clientes-shell-' + SW_VERSION;
const RUNTIME_CACHE = 'unikora-clientes-assets-' + SW_VERSION;
const ALLOWED_CACHES = [SHELL_CACHE, RUNTIME_CACHE];

const APP_SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

const BYPASS_HOSTS = [
  'supabase.co',
  'ntfy.sh',
  'mercadopago.com',
  'api.mercadopago.com',
  'router.project-osrm.org',
  'fcm.googleapis.com'
];

const isBypassUrl = (urlStr) => {
  const u = String(urlStr || '').toLowerCase();
  return BYPASS_HOSTS.some((h) => u.includes(h));
};

const isCacheableStaticAsset = (req, urlObj) => {
  if (urlObj.origin !== self.location.origin) return false;
  const p = urlObj.pathname.toLowerCase();
  if (p.includes('/assets/')) return true;
  if (/\.(js|mjs|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp|wav|json)$/i.test(p)) return true;
  return ['script', 'style', 'font', 'image', 'audio'].includes(req.destination);
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !ALLOWED_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;
  if (isBypassUrl(req.url)) return;

  let urlObj;
  try {
    urlObj = new URL(req.url);
  } catch {
    return;
  }

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html') || caches.match('./')))
    );
    return;
  }

  if (isCacheableStaticAsset(req, urlObj)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const netFetch = fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || netFetch;
      })
    );
    return;
  }

  if (urlObj.origin === self.location.origin) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'UNIKORA Clientes', body: 'Tienes una actualización en tu pedido.' };
  try {
    const parsed = event.data ? event.data.json() : null;
    if (parsed) data = { ...data, ...parsed };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'UNIKORA Clientes', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './apple-touch-icon.png',
      vibrate: [400, 150, 400, 150, 700],
      data
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
