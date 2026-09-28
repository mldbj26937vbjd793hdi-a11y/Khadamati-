// ===== Monetag (verification + ad SDK) =====
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

const CACHE_NAME = 'khadamati-cache-v5';

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
            .then(cache => {

                return cache.addAll(STATIC_ASSETS);

            })
            .catch(error => {

                console.log(
                    'Cache install error:',
                    error
                );

            })

    );


    // تفعيل النسخة الجديدة مباشرة
    self.skipWaiting();

});


// =====================================================
// ACTIVATE
// =====================================================

self.addEventListener('activate', event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(
                            cacheName =>
                                cacheName !== CACHE_NAME
                        )
                        .map(
                            cacheName =>
                                caches.delete(cacheName)
                        )

                );

            })
            .then(() => {

                return self.clients.claim();

            })

    );

});


// =====================================================
// MESSAGES
// =====================================================

self.addEventListener('message', event => {

    if(
        event.data &&
        event.data.type === 'SKIP_WAITING'
    ){

        self.skipWaiting();

    }


    if(
        event.data &&
        event.data.type === 'CLEAR_CACHE'
    ){

        event.waitUntil(

            caches.keys()
                .then(cacheNames => {

                    return Promise.all(

                        cacheNames.map(
                            cacheName =>
                                caches.delete(cacheName)
                        )

                    );

                })

        );

    }

});


// =====================================================
// FETCH
// =====================================================

self.addEventListener('fetch', event => {

    if(
        event.request.method !== 'GET'
    ){

        return;

    }


    const url =
        new URL(event.request.url);


    // =================================================
    // لا نتدخل في Firebase و Google APIs
    // =================================================

    if(

        url.hostname.includes(
            'firebaseio.com'
        ) ||

        url.hostname.includes(
            'googleapis.com'
        ) ||

        url.hostname.includes(
            'gstatic.com'
        ) ||

        url.hostname.includes(
            'google.com'
        )

    ){

        return;

    }


    // =================================================
    // صفحات HTML
    // =================================================
    // الإنترنت أولاً حتى يحصل المستخدم على آخر نسخة
    // =================================================

    if(

        event.request.mode === 'navigate' ||

        url.pathname.endsWith('/') ||

        url.pathname.endsWith(
            '/index.html'
        ) ||

        url.pathname.endsWith(
            'index.html'
        )

    ){

        event.respondWith(

            fetch(
                event.request,
                {
                    cache: 'no-store'
                }
            )

            .then(response => {

                if(
                    response &&
                    response.ok
                ){

                    const clone =
                        response.clone();


                    caches.open(
                        CACHE_NAME
                    )
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

                    if(cachedResponse){

                        return cachedResponse;

                    }


                    return new Response(

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
    // الملفات الثابتة
    // =================================================

    event.respondWith(

        caches.match(
            event.request
        )

        .then(cachedResponse => {

            if(cachedResponse){

                return cachedResponse;

            }


            return fetch(
                event.request
            )

            .then(response => {

                if(

                    response &&

                    response.status === 200 &&

                    response.type === 'basic'

                ){

                    const clone =
                        response.clone();


                    caches.open(
                        CACHE_NAME
                    )

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
