// KAZA — Service Worker (PWA installable + notifications push futures)
// Stratégie : network-first pour la navigation, cache-first pour les assets.
// note : la partie push (OneSignal/FCM) s'ajoutera en V2 avec les tokens.

const CACHE = 'kaza-v1';
const PRECACHE = ['/', '/explorer', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // API et Supabase : jamais de cache
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return;

  // navigation et pages : network-first avec fallback cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/explorer'))),
    );
    return;
  }

  // assets statiques : cache-first avec mise à jour en arrière-plan
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});

// notif push — placeholder V2 (OneSignal/FCM)
self.addEventListener('push', (event) => {
  const data = event.data?.json?.() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Kaza', {
      body: data.body ?? '',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
    }),
  );
});