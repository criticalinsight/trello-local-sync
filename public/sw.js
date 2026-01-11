const CACHE_NAME = 'trello-local-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        (async () => {
            try {
                // 1. Navigation request? Serve index.html
                if (event.request.mode === 'navigate') {
                    const cachedIndex = await caches.match('/index.html');
                    if (cachedIndex) return cachedIndex;

                    const networkIndex = await fetch(event.request);
                    return networkIndex;
                }

                // 2. Stale-while-revalidate for others
                const cachedResponse = await caches.match(event.request);
                const networkFetch = fetch(event.request).then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                }).catch(() => {
                    // Network failed? Return valid cache or nothing (let browser handle error)
                    return cachedResponse;
                });

                return cachedResponse || await networkFetch;

            } catch (error) {
                console.error('SW Fetch Error:', error);
                return fetch(event.request); // Fallback to direct network
            }
        })()
    );
});
