// PWA SW: scope에 종속된 상대경로 사용 (서브패스 배포 호환)
const CACHE = 'wht-v10';
const SCOPE = self.registration.scope; // 예: https://user.github.io/repo/
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'icon.svg', 'apple-touch-icon.png'].map(
  (p) => SCOPE + p
);

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('google.com')) return;
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match(SCOPE + 'index.html')))
  );
});
