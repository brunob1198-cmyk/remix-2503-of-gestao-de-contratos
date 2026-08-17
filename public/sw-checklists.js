// Service Worker PWA dedicado ao Módulo CHECKLISTS
const CACHE_NAME = "checklists-pwa-v1";
const OFFLINE_URLS = [
  "/",
  "/index.html",
  "/medicoes/checklists",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW Checklists] Caching offline assets...");
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn("[SW Checklists] Falha parcial ao armazenar em cache:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SW Checklists] Removendo cache antigo:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Apenas interceptar requisições GET para o módulo de checklists
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Não interceptar requisições Supabase API ou Cloudflare R2
  if (url.hostname.includes("supabase") || url.hostname.includes("r2.dev") || url.hostname.includes("workers.dev")) {
    return;
  }

  // Network First com fallback para Cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
      })
  );
});
