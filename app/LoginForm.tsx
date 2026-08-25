"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browserClient";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUp, setSignedUp] = useState(false);
  const [swInfo, setSwInfo] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // 진단용: 이 페이지를 지금 서비스워커가 컨트롤하고 있는지, 등록된 서비스워커가 있는지 화면에 보여준다.
  // 로그인 페이지는 InstallPrompt(로그인 후에만 렌더)가 없어서 서비스워커 등록/갱신 코드가 아예 안 도는데,
  // 예전에 등록된 서비스워커가 남아있다면 그게 계속 이 페이지를 컨트롤하고 있을 수 있다 — 그게 원인인지
  // 직접 확인하기 위함. 원인 확인되면 지울 것.
  async function checkSwState() {
    if (!("serviceWorker" in navigator)) {
      setSwInfo("serviceWorker 미지원 브라우저");
      return;
    }
    const regs = await navigator.serviceWorker.getRegistrations();
    const controller = navigator.serviceWorker.controller;
    setSwInfo(
      `controller: ${controller ? controller.scriptURL : "없음"} / 등록된 SW ${regs.length}개` +
        regs.map((r, i) => `\n  [${i}] active=${r.active?.scriptURL ?? "-"} waiting=${!!r.waiting} installing=${!!r.installing}`).join("")
    );
  }

  useEffect(() => {
    checkSwState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resetServiceWorker() {
    setResetting(true);
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      window.location.reload();
    } finally {
      setResetting(false);
    }
  }

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setError(error.message);
          return;
        }
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          setError(error.message);
          return;
        }
        // 이메일 확인이 꺼져있으면 가입과 동시에 세션이 생김 — 바로 들어가면 됨
        if (data.session) {
          router.refresh();
        } else {
          setSignedUp(true);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[24rem] flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character/horse-greet.svg" alt="" className="h-20 w-20" />
        <h1 className="font-heading text-3xl font-bold text-ink">TOOK — 툭</h1>
        <p className="text-sm text-steel">로그인하면 내 메모만 안전하게 보여요.</p>
      </div>

      {signedUp ? (
        <p className="rounded-lg bg-surface px-4 py-3 text-center text-sm text-ink">
          가입됐어요. 이제 이 이메일과 비밀번호로 로그인해주세요.
        </p>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 w-full rounded-md border border-hairline-strong bg-canvas px-4 text-base text-ink outline-none focus:border-2 focus:border-primary"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="비밀번호"
            className="h-11 w-full rounded-md border border-hairline-strong bg-canvas px-4 text-base text-ink outline-none focus:border-2 focus:border-primary"
          />
          <button
            onClick={handleSubmit}
            disabled={busy || !email.trim() || !password}
            className="h-11 w-full rounded-md bg-primary text-sm font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
          >
            {busy ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}
          </button>
          {error && (
            <div className="rounded-md bg-surface px-3 py-2 text-xs text-error">
              <p>{error}</p>
              <button onClick={resetServiceWorker} disabled={resetting} className="mt-1 underline">
                {resetting ? "초기화 중..." : "로그인이 안 되면 여기를 눌러 초기화해보세요"}
              </button>
            </div>
          )}
          <button
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError(null);
            }}
            className="text-xs text-steel underline"
          >
            {mode === "signin" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
          </button>
          {swInfo && <p className="whitespace-pre-line text-[10px] text-muted">{swInfo}</p>}
        </div>
      )}
    </main>
  );
}
