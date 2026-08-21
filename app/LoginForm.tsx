"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browserClient";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[24rem] flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character/horse-greet.svg" alt="" className="h-20 w-20" />
        <h1 className="font-heading text-3xl font-bold text-ink">TOOK — 툭</h1>
        <p className="text-sm text-steel">이메일로 로그인하면 내 메모만 안전하게 보여요.</p>
      </div>

      {sent ? (
        <p className="rounded-lg bg-surface px-4 py-3 text-center text-sm text-ink">
          {email}로 로그인 링크를 보냈어요. 메일함을 확인해주세요.
        </p>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="you@example.com"
            className="h-11 w-full rounded-md border border-hairline-strong bg-canvas px-4 text-base text-ink outline-none focus:border-2 focus:border-primary"
          />
          <button
            onClick={handleSend}
            disabled={sending || !email.trim()}
            className="h-11 w-full rounded-md bg-primary text-sm font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
          >
            {sending ? "보내는 중..." : "로그인 링크 받기"}
          </button>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      )}
    </main>
  );
}
