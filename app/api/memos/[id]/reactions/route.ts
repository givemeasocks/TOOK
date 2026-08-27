import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";

const ALLOWED_EMOJI = ["💩", "❤️", "😂", "👏", "🧟"];

/** 롱프레스로 이모지 1개를 남긴다(13번). 사람당 메모당 1개만 — 다시 누르면 덮어쓰기. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  const { emoji } = await request.json();
  if (typeof emoji !== "string" || !ALLOWED_EMOJI.includes(emoji)) {
    return NextResponse.json({ error: "지원하지 않는 이모지입니다" }, { status: 400 });
  }

  const { error } = await supabase
    .from("memo_reactions")
    .upsert({ memo_id: id, user_id: user.id, emoji }, { onConflict: "memo_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** 내 반응을 지운다(같은 이모지 다시 누르면 토글 해제하는 용도). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase.from("memo_reactions").delete().eq("memo_id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
