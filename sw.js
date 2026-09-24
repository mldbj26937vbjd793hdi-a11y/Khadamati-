// ===== Monetag (verification + ad SDK) =====
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11843136
}
self.lary = ""
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw')

// ===== خدماتي: Service Worker بسيط — كيخلي الموقع "قابل للتثبيت" (installable) =====
// وكيحفظ الصفحة الرئيسية للعمل حتى بلا انترنت

const CACHE_NAME = 'khadamati-cache-v5-notifications';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// عند التثبيت: نحفظو الملفات الأساسية فالكاش
// (ماكنديروش skipWaiting هنا تلقائياً، باش نقدرو نعرضو للمستخدم تنبيه "كاين تحديث" قبل التفعيل)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// نستنى رسالة من الصفحة (كي يدوس المستخدم "تحديث الآن") قبل ما نفعّلو النسخة الجديدة
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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


// ===== إشعارات الرسائل والإشعارات العامة =====
// كيدعم إشعارات Push اللي كتجي للـ Service Worker، بما فيها payloads ديال FCM.
// إشعارات الصفحة نفسها كتستعمل reg.showNotification() من index.html.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data = {};

    try {
      data = event.data ? event.data.json() : {};
    } catch (e) {
      try {
        data = { body: event.data ? event.data.text() : '' };
      } catch (err) {
        data = {};
      }
    }

    const notification = data.notification || data;
    const title = notification.title || data.title || 'خدماتي';
    const body = notification.body || data.body || 'لديك إشعار جديد';

    const targetUrl =
      (data.data && (data.data.url || data.data.link)) ||
      notification.click_action ||
      data.url ||
      './index.html';

    await self.registration.showNotification(title, {
      body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag || ('khadamati-push-' + Date.now()),
      renotify: true,
      data: { url: targetUrl }
    });
  })());
});

// عند الضغط على الإشعار: نفتحو التطبيق بدل ما يبقى الإشعار بلا إجراء.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            const target = new URL(targetUrl, self.location.origin);

            if (clientUrl.origin === target.origin && 'focus' in client) {
              if (client.url !== target.href && 'navigate' in client) {
                return client.navigate(target.href).then(() => client.focus());
              }
              return client.focus();
            }
          } catch (e) {}
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(
            new URL(targetUrl, self.location.origin).href
          );
        }
      })
  );
});

// إغلاق الإشعار لا يحتاج لأي إجراء إضافي.
self.addEventListener('notificationclose', () => {});
