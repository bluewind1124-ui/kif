/* 한보금on 앱 설치용 서비스워커 (v8)
   - 포털을 PC·안드로이드에 「앱」으로 설치할 수 있게 해 주는 작은 파일입니다.
   - 내용은 저장해 두지 않고 늘 인터넷에서 새로 받습니다(수정하면 바로 반영).
   - 인터넷이 끊겼을 때만 「연결 안 됨」 안내 화면을 보여 줍니다. */
var OFF = 'kif-offline-v8';
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(OFF).then(function (c) { return c.addAll(['offline.html', 'icon-192.png?v=8']); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== OFF; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () { return caches.match('offline.html'); }));
});
