"use client";

import { useState } from "react";
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
          {error && <p className="text-xs text-error">{error}</p>}
          <button
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError(null);
            }}
            className="text-xs text-steel underline"
          >
            {mode === "signin" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
          </button>
        </div>
      )}
    </main>
  );
}
