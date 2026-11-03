/* 子午穴枢 Service Worker —— 页面网络优先，离线仍有缓存可退 */
/* 缓存名带版本：换版即换缓存，旧的由 activate 清理 */
const CACHE_NAME = 'ziwu-xueshu-1.4.3';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  './releases.json',
  './子午穴枢.manifest.webmanifest',
  './子午穴枢.icon.svg',
  './子午穴枢.icon180.png',
  './images/eye-reference.png'
];

self.addEventListener('install', (event) => {
  // 不在此处 skipWaiting：等页面确认后再跳过等待，避免用户正在看旧页时被切走
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

/* 页面点「刷新」后，让等待中的新版本立即接管 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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
      fetch(req, { cache: 'reload' }).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() =>
        caches.match(req).then((cached) =>
          cached || (req.mode === 'navigate' ? caches.match('./app.html') : undefined)
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
