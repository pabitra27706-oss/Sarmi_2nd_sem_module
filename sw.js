/* ========================================
   SERVICE WORKER
   B.Tech 2nd Sem Module System PWA
   ======================================== */

const APP_VERSION  = 'v1.0.0';
const CACHE_STATIC = `btech-static-${APP_VERSION}`;
const CACHE_DATA   = `btech-data-${APP_VERSION}`;
const CACHE_CDN    = `btech-cdn-${APP_VERSION}`;

// ── Files to cache on install ──
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './offline.html',

    // Module Assets
    './module-assets/css/module-style.css',
    './module-assets/js/module-helpers.js',
    './module-assets/js/module-storage.js',
    './module-assets/js/module-render.js',
    './module-assets/js/module-app.js',
    './module-assets/js/pwa-manager.js',

    // Subject Pages
    './subjects/physics-i/index.html',
    './subjects/mathematics-ii/index.html',
    './subjects/electrical-electronics/index.html'
];

// ── Data files to cache ──
const DATA_ASSETS = [
    // Physics
    './subjects/physics-i/data/module1.json',
    './subjects/physics-i/data/module2.json',
    './subjects/physics-i/data/module3.json',
    './subjects/physics-i/data/module4.json',
    './subjects/physics-i/data/module5.json',

    // Mathematics
    './subjects/mathematics-ii/data/module1.json',
    './subjects/mathematics-ii/data/module2.json',
    './subjects/mathematics-ii/data/module3.json',
    './subjects/mathematics-ii/data/module4.json',
    './subjects/mathematics-ii/data/module5.json',

    // Electrical & Electronics
    './subjects/electrical-electronics/data/module1.json',
    './subjects/electrical-electronics/data/module2.json',
    './subjects/electrical-electronics/data/module3.json',
    './subjects/electrical-electronics/data/module4.json',
    './subjects/electrical-electronics/data/module5.json',
    './subjects/electrical-electronics/data/module6.json',
    './subjects/electrical-electronics/data/module7.json'
];

// ============ INSTALL ============

self.addEventListener('install', (event) => {
    console.log(`[SW] Installing ${APP_VERSION}...`);

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_STATIC).then(async (cache) => {
                console.log('[SW] Caching static assets...');
                const results = await Promise.allSettled(
                    STATIC_ASSETS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn(`[SW] Skip: ${url}`);
                        })
                    )
                );
                const ok = results.filter(r => r.status === 'fulfilled').length;
                console.log(`[SW] Static: ${ok}/${STATIC_ASSETS.length} cached`);
            }),

            // Cache data files
            caches.open(CACHE_DATA).then(async (cache) => {
                console.log('[SW] Caching data files...');
                const results = await Promise.allSettled(
                    DATA_ASSETS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn(`[SW] Skip data: ${url}`);
                        })
                    )
                );
                const ok = results.filter(r => r.status === 'fulfilled').length;
                console.log(`[SW] Data: ${ok}/${DATA_ASSETS.length} cached`);
            }),

            // Cache MathJax CDN
            caches.open(CACHE_CDN).then(async (cache) => {
                try {
                    await cache.add(
                        'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js'
                    );
                    console.log('[SW] MathJax cached');
                } catch (e) {
                    console.warn('[SW] MathJax cache failed');
                }
            })
        ])
        .then(() => {
            console.log('[SW] Install complete!');
            return self.skipWaiting();
        })
    );
});

// ============ ACTIVATE ============

self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating ${APP_VERSION}...`);

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name =>
                            name.startsWith('btech-') &&
                            name !== CACHE_STATIC &&
                            name !== CACHE_DATA &&
                            name !== CACHE_CDN
                        )
                        .map(name => {
                            console.log(`[SW] Deleting old cache: ${name}`);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Activated!');
                return self.clients.claim();
            })
    );
});

// ============ FETCH ============

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension, analytics
    if (url.protocol === 'chrome-extension:') return;
    if (url.hostname.includes('google-analytics')) return;
    if (url.hostname.includes('googletagmanager')) return;

    // ── JSON data → Network First ──
    if (url.pathname.endsWith('.json') && !url.pathname.endsWith('manifest.json')) {
        event.respondWith(networkFirst(request, CACHE_DATA));
        return;
    }

    // ── CDN → Cache First ──
    if (
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com')
    ) {
        event.respondWith(cacheFirst(request, CACHE_CDN));
        return;
    }

    // ── HTML pages → Network First + Offline Fallback ──
    if (
        request.headers.get('accept')?.includes('text/html') ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('/')
    ) {
        event.respondWith(networkFirstHTML(request));
        return;
    }

    // ── JS, CSS, images → Cache First ──
    if (
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico') ||
        url.pathname.endsWith('.woff2')
    ) {
        event.respondWith(cacheFirst(request, CACHE_STATIC));
        return;
    }

    // ── Everything else → Network First ──
    event.respondWith(networkFirst(request, CACHE_STATIC));
});

// ============ CACHING STRATEGIES ============

// Cache First: use cache, fetch in background to refresh
async function cacheFirst(request, cacheName) {
    try {
        const cache  = await caches.open(cacheName);
        const cached = await cache.match(request);

        if (cached) {
            // Background refresh
            fetch(request)
                .then(res => { if (res.ok) cache.put(request, res); })
                .catch(() => {});
            return cached;
        }

        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;

    } catch (error) {
        const cache  = await caches.open(cacheName);
        const cached = await cache.match(request);
        if (cached) return cached;

        return new Response('Offline', { status: 503 });
    }
}

// Network First: try network, fallback to cache
async function networkFirst(request, cacheName) {
    try {
        const cache    = await caches.open(cacheName);
        const response = await fetch(request);

        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;

    } catch (error) {
        // Network failed → try all caches
        const cached = await caches.match(request);
        if (cached) {
            console.log(`[SW] Cache hit: ${request.url}`);
            return cached;
        }

        return new Response(
            JSON.stringify({ error: 'Offline', cached: false }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Network First for HTML with offline page fallback
async function networkFirstHTML(request) {
    try {
        const cache    = await caches.open(CACHE_STATIC);
        const response = await fetch(request);

        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;

    } catch (error) {
        // Try all caches
        const cached = await caches.match(request);
        if (cached) return cached;

        // Return offline page
        const offlinePage = await caches.match('./offline.html');
        if (offlinePage) return offlinePage;

        return new Response(
            offlineHTML(),
            {
                status: 503,
                headers: { 'Content-Type': 'text/html' }
            }
        );
    }
}

// Inline offline page as last resort
function offlineHTML() {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport"
content="width=device-width,initial-scale=1.0">
<title>Offline</title><style>
body{font-family:sans-serif;display:flex;align-items:center;
justify-content:center;min-height:100vh;margin:0;
background:#f0fdf4;color:#1f2937;text-align:center;padding:1rem}
h1{color:#10b981}button{background:#10b981;color:white;
border:none;padding:.75rem 1.5rem;border-radius:.5rem;
font-size:1rem;cursor:pointer;margin-top:1rem}
</style></head><body><div>
<h1>📚 You're Offline</h1>
<p>Check your connection and try again.</p>
<button onclick="location.reload()">🔄 Retry</button>
</div></body></html>`;
}

// ============ MESSAGES ============

self.addEventListener('message', (event) => {
    const { type, payload } = event.data || {};

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'CLEAR_CACHE':
            caches.keys().then(keys =>
                Promise.all(keys.map(k => caches.delete(k)))
            ).then(() => {
                event.ports[0]?.postMessage({ success: true });
            });
            break;

        case 'CACHE_MODULE':
            if (payload?.paths) {
                caches.open(CACHE_DATA).then(cache => {
                    Promise.allSettled(
                        payload.paths.map(p =>
                            cache.add(p).catch(() => {})
                        )
                    ).then(() => {
                        event.ports[0]?.postMessage({ success: true });
                    });
                });
            }
            break;

        case 'GET_CACHE_INFO':
            getCacheInfo().then(info => {
                event.ports[0]?.postMessage(info);
            });
            break;

        case 'GET_VERSION':
            event.ports[0]?.postMessage({ version: APP_VERSION });
            break;
    }
});

async function getCacheInfo() {
    const names = await caches.keys();
    const info  = {};

    for (const name of names) {
        const cache = await caches.open(name);
        const keys  = await cache.keys();
        info[name]  = keys.length;
    }

    return {
        caches:      info,
        version:     APP_VERSION,
        totalFiles:  Object.values(info).reduce((a, b) => a + b, 0),
        totalCaches: names.length
    };
}