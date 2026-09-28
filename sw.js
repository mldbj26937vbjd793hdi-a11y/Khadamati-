// ===== Monetag (verification + ad SDK) =====
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11843136
}
self.lary = ""

importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw');


// ===== Khadamati Service Worker =====

const CACHE_NAME = 'khadamati-cache-v5';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];


// ===== Install =====
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .catch(err => {
                console.log('Cache install error:', err);
            })
    );

    // تفعيل النسخة الجديدة مباشرة
    self.skipWaiting();
});


// ===== Activate =====
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});


// ===== Messages =====
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            })
        );
    }
});


// ===== Fetch =====
self.addEventListener('fetch', (event) => {

    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // لا نتدخل في Firebase و Google APIs
    if (
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('google.com')
    ) {
        return;
    }


    // ===== صفحات HTML =====
    // نحاول الحصول على آخر نسخة من الإنترنت أولاً
    if (
        event.request.mode === 'navigate' ||
        url.pathname.endsWith('/') ||
        url.pathname.endsWith('/index.html') ||
        url.pathname.endsWith('index.html')
    ) {

        event.respondWith(
            fetch(event.request, {
                cache: 'no-store'
            })
            .then(response => {

                if (response && response.ok) {

                    const responseClone = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put('./index.html', responseClone);
                        });

                }

                return response;

            })
            .catch(() => {

                return caches.match('./index.html')
                    .then(cachedResponse => {

                        return cachedResponse || new Response(
                            'لا يمكن الاتصال بالإنترنت',
                            {
                                status: 503,
                                headers: {
                                    'Content-Type': 'text/plain; charset=utf-8'
                                }
                            }
                        );

                    });

            })
        );

        return;
    }


    // ===== الملفات الثابتة =====
    // CSS / JS / صور وغيرها
    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(response => {

                        if (
                            response &&
                            response.status === 200 &&
                            response.type === 'basic'
                        ) {

                            const responseClone = response.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseClone);
                                });
                        }

                        return response;

                    })
                    .catch(() => {
                        return cachedResponse;
                    });

            })

    );

});
