"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** PRD의 홈 위젯을 이 웹앱에서는 "홈 화면에 추가"(PWA 설치)로 대체한다. */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window));

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (standalone || dismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm text-ink">
      {deferredPrompt ? (
        <>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/character/horse-watch.svg" alt="" className="h-10 w-10 shrink-0" />
            <span>홈 화면에 추가해두면 앱처럼 바로 열 수 있어요.</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={async () => {
                await deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                setDeferredPrompt(null);
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary"
            >
              홈 화면에 추가
            </button>
            <button onClick={() => setDismissed(true)} className="text-xs text-steel" aria-label="닫기">
              닫기
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/character/horse-watch.svg" alt="" className="h-10 w-10 shrink-0" />
            <span>공유 버튼 → &quot;홈 화면에 추가&quot;로 등록하면 앱처럼 바로 열 수 있어요.</span>
          </div>
          <button onClick={() => setDismissed(true)} className="shrink-0 text-xs text-steel" aria-label="닫기">
            닫기
          </button>
        </>
      )}
    </div>
  );
}
