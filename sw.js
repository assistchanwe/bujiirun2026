// 부지런 오프라인 저장 (서비스 워커)
// 한 번 앱을 열면 앱 화면·QR 인식 모듈·배치도 이미지를 휴대폰에 저장해 두고,
// 인터넷이 끊기거나 느려도 저장본으로 앱을 연다.
// 앱 파일을 고쳐 배포할 때는 VERSION 을 올리면 예전 저장본이 정리된다.
const VERSION = 'bujiirun-v2';
const FILES = ['./', './index.html', './jsQR.min.js', './booth-map.webp'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 구글 폼·인스타 등 외부 주소는 건드리지 않는다

  if (req.mode === 'navigate') {
    // 앱 화면: 인터넷이 되면 최신 버전을 받아 저장본도 갱신하고, 안 되면(또는 4초 넘게 느리면) 저장본을 연다
    event.respondWith(
      new Promise(resolve => {
        let done = false;
        const fromCache = () => caches.match('./index.html').then(r => { if (!done && r) { done = true; resolve(r); } });
        const timer = setTimeout(fromCache, 4000);
        fetch(req).then(res => {
          clearTimeout(timer);
          if (res.ok) caches.open(VERSION).then(c => c.put('./index.html', res.clone()));
          if (!done) { done = true; resolve(res); }
        }).catch(() => {
          clearTimeout(timer);
          fromCache().then(() => { if (!done) { done = true; resolve(Response.error()); } });
        });
      })
    );
    return;
  }

  // QR 모듈·이미지 등: 저장본이 있으면 바로 쓰고, 없으면 받아서 저장
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
