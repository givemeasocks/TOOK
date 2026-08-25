// PWA 설치 조건(HTTPS + manifest + fetch 핸들러 있는 서비스워커) 충족용 최소 구현.
// 오프라인 캐싱은 v1 범위 밖 — 항상 네트워크로 그대로 통과시킨다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// respondWith를 아예 안 부른다 — iOS Safari는 서비스워커가 respondWith(fetch(...))로 요청을
// 가로채면 교차 출처(예: 로그인 시 Supabase로 보내는 POST) 요청이 "Load failed"로 실패하거나,
// standalone/카카오톡 인앱 브라우저 같은 특수 웹뷰에서 페이지 이동 자체가 영영 안 끝나는 흰 화면
// 버그가 알려져 있다. 이 서비스워커는 원래 캐싱을 안 해서(설치 조건 충족용) 가로챌 이유가 아예
// 없으므로, 리스너만 등록해두고 모든 요청은 그냥 브라우저가 직접 처리하게 둔다.
self.addEventListener("fetch", () => {});

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
