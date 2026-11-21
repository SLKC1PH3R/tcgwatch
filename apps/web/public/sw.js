/* TCGWatch — service worker : notifications du navigateur et mode hors-ligne. */
const VERSION = 'v1';
const SHELL = `tcgwatch-shell-${VERSION}`;
const PAGES = `tcgwatch-pages-${VERSION}`;
const OFFLINE_URL = '/hors-ligne';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll([OFFLINE_URL, '/icon.svg', '/manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => ![SHELL, PAGES].includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Pages consultables hors-ligne : la collection (sa dernière version vue est gardée), et une
 * page « hors-ligne » pour le reste. Réseau d'abord : en ligne, tout reste à jour.
 */
const OFFLINE_PAGES = ['/collection', '/collection/cartes'];

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const keep = OFFLINE_PAGES.includes(url.pathname);
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (keep && res.ok) {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(url.pathname, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = keep ? await caches.match(url.pathname) : undefined;
        return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
      }),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'TCGWatch', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'TCGWatch', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      silent: Boolean(data.silent),
      data: { url: data.url || '/alertes' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/alertes';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const same = list.find((c) => c.url === url);
      if (same) return same.focus();
      return self.clients.openWindow(url);
    }),
  );
});
