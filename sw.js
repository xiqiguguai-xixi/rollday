/* RollDay Service Worker */
const CACHE_NAME = 'rollday-v10';

// 需要离线缓存的核心文件
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 安装：预缓存核心文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        CORE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] 跳过', url, err))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只处理 GET
  if (req.method !== 'GET') return;

  // 只处理同源请求
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // HTML：网络优先，失败回落缓存
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(r => r || caches.match('./index.html'))
        )
    );
  } else {
    // 其它资源：缓存优先
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});

// 支持页面主动触发更新
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});