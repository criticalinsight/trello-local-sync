// Auto-updating service worker with versioned cache
// Cache name includes build timestamp for automatic invalidation
const CACHE_VERSION = 'v' + Date.now(); // Changes on each deployment
const CACHE_NAME = `trello-local-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = ['/', '/index.html', '/manifest.json'];

// Install: Cache essential assets and skip waiting
self.addEventListener('install', (event) => {
    console.log('[SW] Installing new version:', CACHE_NAME);
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting()), // Immediately activate new SW
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating new version:', CACHE_NAME);
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('trello-local-') && name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        }),
                );
            })
            .then(() => self.clients.claim()), // Take control of all clients immediately
    );
});

// Fetch: Network-first for HTML, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests and external URLs
    if (event.request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
        return;
    }

    event.respondWith(
        (async () => {
            try {
                // Navigation requests: Always try network first for fresh HTML
                if (event.request.mode === 'navigate') {
                    try {
                        const networkResponse = await fetch(event.request);
                        // Cache the fresh response
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    } catch (error) {
                        // Network failed, fall back to cache
                        const cached = await caches.match('/index.html');
                        if (cached) return cached;
                        throw error;
                    }
                }

                // Assets with hash in filename: Cache forever (immutable)
                if (url.pathname.match(/\.[a-f0-9]{8,}\.(js|css|wasm|data)$/)) {
                    const cached = await caches.match(event.request);
                    if (cached) return cached;

                    const response = await fetch(event.request);
                    if (response.ok) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(event.request, response.clone());
                    }
                    return response;
                }

                // Other assets: Network first with cache fallback
                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse.ok) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    const cached = await caches.match(event.request);
                    if (cached) return cached;
                    throw error;
                }
            } catch (error) {
                console.error('[SW] Fetch Error:', error);
                return new Response('Offline', { status: 503 });
            }
        })(),
    );
});

// Listen for messages to trigger updates
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
