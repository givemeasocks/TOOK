import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** 로그인한 사용자 세션이 그대로 실린 클라이언트. RLS가 이 세션 기준으로 데이터를 자동으로 걸러준다. */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component에서 호출되면 쿠키를 못 씀 — 세션 갱신은 middleware.ts가 맡으므로 무시해도 됨
          }
        },
      },
    }
  );
}

/** API 라우트 공통 가드: 로그인 안 돼있으면 user가 null. */
export async function requireUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
