// Service Worker بسيط لخدماتي — كيخلي الموقع "قابل للتثبيت" (installable)
// وكيحفظ الصفحة الرئيسية للعمل حتى بلا انترنت

const CACHE_NAME = 'khadamati-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// عند التثبيت: نحفظو الملفات الأساسية فالكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// عند التفعيل: نمسحو أي كاش قديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// عند الطلب: نجاوبو من الكاش إذا موجود، وإلا من الانترنت
self.addEventListener('fetch', (event) => {
  // نتجاهلو الطلبات ديال Firebase وGoogle APIs (خليهم يمشيو للانترنت مباشرة)
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // إذا فشل الطلب وما كاينش كاش، رجّع الصفحة الرئيسية (fallback بسيط)
        return caches.match('./index.html');
      });
    })
  );
});
