/* VurguSil service worker — çevrimdışı çalışma + kalıcı önbellek.
 * İlk ziyaretten sonra tüm uygulama cihaza kaydedilir; internet
 * olmasa bile açılır ve PDF temizlemeye devam eder. */
const CACHE = "vurgusil-v3";
const OFFLINE_URL = "./index.html";

const CACHEABLE_HOSTS = [
  self.location.host,
  "cdn.jsdelivr.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/* Uygulama açılışta kullandığı tüm kaynakları bildirir → kabuk önbelleğe iner */
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg && msg.type === "PRECACHE_SHELL" && Array.isArray(msg.urls)) {
    event.waitUntil(
      caches.open(CACHE).then((cache) =>
        Promise.allSettled(msg.urls.map((u) => cache.add(u).catch(() => {})))
      )
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!CACHEABLE_HOSTS.includes(url.host)) return;

  // Sayfa gezintileri: önce ağ, çevrimdışıyken önbellekten aç
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(OFFLINE_URL, copy));
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Statik varlıklar & CDN: önce önbellek, yoksa ağa git ve kaydet
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok || response.type === "opaque") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
