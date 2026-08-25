"use client";

// 렌더링 중 처리 안 된 에러가 나면(예: 특정 브라우저에 없는 전역 API를 잘못 건드리는 경우) 이 화면이
// 흰 화면 대신 뜬다 — 에러 바운더리가 없으면 React가 트리 전체를 내려버려서 흰 화면만 보이게 된다.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/character/horse-tilt-head.svg" alt="" className="h-20 w-20" />
      <p className="text-sm text-ink">어라, 갑자기 멈췄어요. 다시 시도해볼까요?</p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
      >
        다시 시도
      </button>
    </div>
  );
}
