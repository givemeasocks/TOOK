import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";

/** 카드를 펼쳐서 원문을 읽으면 호출됨 (PRD 7.6 리마인드의 "열람" 판정 기준). 이미 봤으면 그대로 둔다. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;

  const { data: memo } = await supabase.from("memos").select("viewed_at").eq("id", id).maybeSingle();
  if (memo && !memo.viewed_at) {
    await supabase.from("memos").update({ viewed_at: new Date().toISOString() }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
