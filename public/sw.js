// PWA 설치 조건(HTTPS + manifest + fetch 핸들러 있는 서비스워커) 충족용 최소 구현.
// 오프라인 캐싱은 v1 범위 밖 — 항상 네트워크로 그대로 통과시킨다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
