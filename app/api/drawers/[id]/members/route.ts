import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";
import type { DrawerMemberRow } from "@/lib/supabase/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from("drawer_members")
    .select("id, invited_email, status, user_id, last_visited_at")
    .eq("drawer_id", id)
    .order("created_at", { ascending: true })
    .returns<Pick<DrawerMemberRow, "id" | "invited_email" | "status" | "user_id" | "last_visited_at">[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 7번: "OO가 방금 하나 넣고 갔어" — 내가 마지막으로 방문한 시각 이후 다른 멤버가 넣은 메모가 있으면 배너.
  // 배너를 계산한 뒤에 방문 시각을 지금으로 갱신한다(같은 배너가 다음 방문에도 또 뜨지 않게).
  const myRow = (data ?? []).find((m) => m.user_id === user.id);
  let visitBanner: string | null = null;
  if (myRow) {
    const { data: latestMemo } = await supabase
      .from("memos")
      .select("user_id, created_at")
      .eq("drawer_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      latestMemo &&
      latestMemo.user_id &&
      latestMemo.user_id !== user.id &&
      (!myRow.last_visited_at || latestMemo.created_at > myRow.last_visited_at)
    ) {
      const author = (data ?? []).find((m) => m.user_id === latestMemo.user_id);
      if (author) visitBanner = `${author.invited_email}가 방금 하나 넣고 갔어`;
    }
    await supabase.from("drawer_members").update({ last_visited_at: new Date().toISOString() }).eq("id", myRow.id);
  }

  return NextResponse.json({ members: data, visitBanner });
}

/** 서랍에서 나가거나(본인) 다른 멤버를 내보낸다 — 동등한 권한이라 누구든 할 수 있음. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다" }, { status: 400 });
  }

  const { error } = await supabase.from("drawer_members").delete().eq("id", memberId).eq("drawer_id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
