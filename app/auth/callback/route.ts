import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/serverClient";

/** 매직 링크 이메일 안의 링크가 여기로 온다. code를 세션으로 교환하고 홈으로 돌려보낸다. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await getSupabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
    // 내 이메일로 온 서랍 초대가 있으면 이번 로그인으로 계정에 붙인다
    await supabase.rpc("claim_pending_invites");
  }
  return NextResponse.redirect(new URL("/", request.url));
}
