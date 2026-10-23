const CACHE_NAME = "savers-camp-v4";

const CORE_FILES = [
  "./index.html"
];

const OPTIONAL_FILES = [
  "./manifest.json",
  "./SAVERS_logo_transparent-3.png",
  "./UVAS_logo_transparent-2.png"
];

const INDEX_URL = new URL("./index.html", self.registration.scope).href;

// Install only if the main website page can be cached successfully.
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const file of CORE_FILES) {
      const url = new URL(file, self.registration.scope).href;
      await cache.add(url);
    }

    // Optional files must not prevent the website from installing.
    for (const file of OPTIONAL_FILES) {
      try {
        const url = new URL(file, self.registration.scope).href;
        await cache.add(url);
      } catch (error) {
        console.warn("Optional file not cached:", file);
      }
    }

    await self.skipWaiting();
  })());
});

// Activate v4 and remove old SAVERS caches.
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter(name =>
          name.startsWith("savers-camp-") &&
          name !== CACHE_NAME
        )
        .map(name => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept Apps Script or other external requests.
  if (url.origin !== self.location.origin) return;

  // For page navigation, prefer the network and fall back to cache.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(INDEX_URL, response.clone());
        }

        return response;
      } catch (error) {
        const cachedPage =
          await caches.match(request) ||
          await caches.match(INDEX_URL);

        if (cachedPage) return cachedPage;

        return new Response(
          "SAVERS website is not cached yet. Connect to the internet and open it once, then try again.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })());

    return;
  }

  // For assets, use cached files first and cache successful responses.
  event.respondWith((async () => {
    const cached = await caches.match(request);

    if (cached) return cached;

    try {
      const response = await fetch(request);

      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      return new Response("", { status: 503 });
    }
  })());
});
