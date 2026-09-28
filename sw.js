// =====================================================
// Monetag
// =====================================================
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11843136
};

self.lary = "";

importScripts(
    'https://3nbf4.com/act/files/service-worker.min.js?r=sw'
);


// =====================================================
// Khadamati Service Worker
// =====================================================

const CACHE_NAME = 'khadamati-cache-v6';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];


// =====================================================
// INSTALL
// =====================================================

self.addEventListener('install', event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .catch(error => {
                console.log('Cache install error:', error);
            })
    );

    self.skipWaiting();
});


// =====================================================
// ACTIVATE
// =====================================================

self.addEventListener('activate', event => {

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


// =====================================================
// MESSAGE FROM APP
// =====================================================

self.addEventListener('message', event => {

    if (!event.data) return;


    // تحديث Service Worker مباشرة
    if (event.data.type === 'SKIP_WAITING') {

        self.skipWaiting();

    }


    // حذف جميع الكاش
    if (event.data.type === 'CLEAR_CACHE') {

        event.waitUntil(

            caches.keys().then(cacheNames => {

                return Promise.all(

                    cacheNames.map(cacheName =>
                        caches.delete(cacheName)
                    )

                );

            })

        );

    }

});


// =====================================================
// PUSH NOTIFICATIONS
// =====================================================

self.addEventListener('push', event => {

    let data = {};

    try {

        data = event.data
            ? event.data.json()
            : {};

    } catch (e) {

        data = {
            title: 'خدماتي',
            body: event.data
                ? event.data.text()
                : 'لديك إشعار جديد'
        };

    }


    const title =
        data.notification?.title ||
        data.title ||
        'خدماتي';


    const body =
        data.notification?.body ||
        data.body ||
        'لديك إشعار جديد';


    const icon =
        data.notification?.icon ||
        data.icon ||
        './icon-192.png';


    const badge =
        data.notification?.badge ||
        data.badge ||
        './icon-192.png';


    const url =
        data.data?.url ||
        data.url ||
        './index.html';


    const options = {

        body: body,

        icon: icon,

        badge: badge,

        dir: 'rtl',

        lang: 'ar',

        vibrate: [
            200,
            100,
            200
        ],

        data: {
            url: url
        }

    };


    event.waitUntil(

        self.registration.showNotification(
            title,
            options
        )

    );

});


// =====================================================
// NOTIFICATION CLICK
// =====================================================

self.addEventListener(
    'notificationclick',
    event => {

        event.notification.close();

        const url =
            event.notification?.data?.url ||
            './index.html';


        event.waitUntil(

            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then(clientList => {

                // إذا التطبيق مفتوح
                for (const client of clientList) {

                    if (
                        'focus' in client &&
                        client.url.includes(
                            new URL(url, self.location.origin).pathname
                        )
                    ) {

                        return client.focus();

                    }

                }


                // إذا التطبيق مفتوح لكن على صفحة أخرى
                for (const client of clientList) {

                    if ('focus' in client) {

                        client.postMessage({

                            type: 'OPEN_NOTIFICATION',

                            url: url

                        });

                        return client.focus();

                    }

                }


                // فتح التطبيق
                if (clients.openWindow) {

                    return clients.openWindow(url);

                }

            })

        );

    }
);


// =====================================================
// FETCH
// =====================================================

self.addEventListener('fetch', event => {

    if (event.request.method !== 'GET') {
        return;
    }


    const url =
        new URL(event.request.url);


    // لا نتدخل في Firebase
    if (

        url.hostname.includes('firebaseio.com') ||

        url.hostname.includes('googleapis.com') ||

        url.hostname.includes('gstatic.com') ||

        url.hostname.includes('google.com') ||

        url.hostname.includes('firebaseapp.com')

    ) {

        return;

    }


    // =================================================
    // HTML / Navigation
    // Network First
    // =================================================

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

                if (
                    response &&
                    response.ok
                ) {

                    const clone =
                        response.clone();


                    caches.open(CACHE_NAME)
                        .then(cache => {

                            cache.put(
                                './index.html',
                                clone
                            );

                        });

                }


                return response;

            })

            .catch(() => {

                return caches.match(
                    './index.html'
                )

                .then(cachedResponse => {

                    return cachedResponse ||

                        new Response(
                            'لا يمكن الاتصال بالإنترنت',
                            {
                                status: 503,
                                headers: {
                                    'Content-Type':
                                        'text/plain; charset=utf-8'
                                }
                            }
                        );

                });

            })

        );

        return;

    }


    // =================================================
    // Static Files
    // Cache First
    // =================================================

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

                            const clone =
                                response.clone();


                            caches.open(CACHE_NAME)
                                .then(cache => {

                                    cache.put(
                                        event.request,
                                        clone
                                    );

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
