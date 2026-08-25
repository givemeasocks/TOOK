// PWA 설치 조건(HTTPS + manifest + fetch 핸들러 있는 서비스워커) 충족용 최소 구현.
// 오프라인 캐싱은 v1 범위 밖 — 항상 네트워크로 그대로 통과시킨다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // 페이지 이동(문서 요청) 자체를 가로채면 일부 iOS WebView(홈화면에 추가한 standalone 실행,
  // 카카오톡 인앱 브라우저 등)에서 응답이 영영 안 끝나는 흰 화면 멈춤이 보고된 적 있다 — 알려진
  // iOS WebKit 버그 패턴. 이 서비스워커는 애초에 캐싱을 안 해서(설치 조건 충족용) 가로챌 이유가
  // 없으므로, navigate 요청은 그냥 건드리지 않고 브라우저가 직접 처리하게 둔다.
  if (event.request.mode === "navigate") return;
  event.respondWith(fetch(event.request));
});

// PRD 7.6 리마인드: 서버(app/api/cron/reminders)가 보낸 push를 알림으로 띄운다.
self.addEventListener("push", (event) => {
  let payload = { title: "TOOK", body: "", url: "/" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // 본문이 없거나 JSON이 아니면 기본값 그대로 둠
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
