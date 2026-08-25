"use client";

import { useEffect, useState } from "react";

// VAPID 공개키(base64url) → pushManager.subscribe가 요구하는 Uint8Array 형식으로 변환
function urlBase64ToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** PRD O-4 "알림 권한 요청(이유 설명 후)"을 이 웹앱의 첫 화면 배너로 구현. 리마인드는 PRD 7.6 참고. */
export default function ReminderOptIn() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 카카오톡 인앱 브라우저 등 일부 iOS WebView는 serviceWorker/PushManager는 있어도
    // Notification 전역 자체가 없어서, 아래에서 바로 Notification.permission을 읽으면
    // ReferenceError로 렌더링 전체가 죽는다(에러 바운더리가 없어 흰 화면으로 보임) — 반드시 먼저 체크.
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    setSupported(true);
    setDenied(Notification.permission === "denied");

    navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(permission === "denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const json = subscription.toJSON();

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }

  if (!supported || subscribed || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm text-ink">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character/horse-plead.svg" alt="" className="h-10 w-10 shrink-0" />
        <span>
          {denied
            ? "브라우저 알림이 꺼져있어요. 켜고 싶으면 사이트 설정에서 알림을 허용해주세요."
            : "묵혀둔 메모나 많이 쌓인 서랍이 있으면 가끔 알려드릴게요. 하루 최대 1건만 보내요."}
        </span>
      </div>
      {!denied && (
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={enable}
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary disabled:opacity-50"
          >
            {busy ? "켜는 중..." : "알림 받기"}
          </button>
          <button onClick={() => setDismissed(true)} className="text-xs text-steel" aria-label="닫기">
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
