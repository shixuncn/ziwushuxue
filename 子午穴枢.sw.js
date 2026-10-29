/* 子午穴枢 Service Worker —— 页面网络优先，离线仍有缓存可退 */
const CACHE_NAME = 'ziwu-xueshu-v4';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  './子午穴枢.html',
  './releases.json',
  './子午穴枢.manifest.webmanifest',
  './子午穴枢.icon.svg',
  './子午穴枢.icon180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isFreshFirst(req) {
  return req.mode === 'navigate'
    || req.destination === 'document'
    || req.destination === 'script'
    || req.destination === 'style'
    || /\.(html|json)$/i.test(new URL(req.url).pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 页面、脚本、样式、JSON：先走网络，拿不到再回缓存（保证更新立即生效）
  if (isFreshFirst(req)) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() =>
        caches.match(req).then((cached) =>
          cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
        )
      )
    );
    return;
  }

  // 图标、安装包等：缓存优先，后台静默更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
