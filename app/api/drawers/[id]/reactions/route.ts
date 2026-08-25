import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";

/** 서랍을 열 때 그 안 메모들의 이모지 반응을 한 번에 가져온다(13번). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from("memo_reactions")
    .select("memo_id, user_id, emoji, memos!inner(drawer_id)")
    .eq("memos.drawer_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reactions = (data ?? []).map((r) => ({ memoId: r.memo_id, userId: r.user_id, emoji: r.emoji }));
  return NextResponse.json({ reactions });
}
