import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";
import { findOrCreateDrawerId } from "@/lib/drawers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  const { category, mode = "move" } = await request.json();

  if (typeof category !== "string" || !category.trim()) {
    return NextResponse.json({ error: "category가 비어있습니다" }, { status: 400 });
  }
  if (mode !== "move" && mode !== "copy") {
    return NextResponse.json({ error: "mode는 move 또는 copy여야 합니다" }, { status: 400 });
  }

  const trimmed = category.trim();
  const targetDrawerId = await findOrCreateDrawerId(supabase, user.id, user.email ?? "", trimmed);

  // copy: 원본은 그대로 두고, 같은 내용으로 새 서랍에 메모를 하나 더 만든다 (두 서랍에 동시에 존재)
  if (mode === "copy") {
    const { data: original, error: fetchError } = await supabase
      .from("memos")
      .select("content, summary, embedding, source")
      .eq("id", id)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: fetchError?.message ?? "원본 메모를 찾을 수 없습니다" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("memos")
      .insert({
        content: original.content,
        summary: original.summary,
        embedding: original.embedding,
        source: original.source,
        drawer_id: targetDrawerId,
        category_edited: true,
        user_id: user.id,
      })
      .select("id, category_edited")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ memo: { ...data, category: trimmed }, copied: true });
  }

  // move: 기존 메모의 서랍만 바꾼다 (원래 서랍에서는 사라짐)
  const { data, error } = await supabase
    .from("memos")
    .update({ drawer_id: targetDrawerId, category_edited: true })
    .eq("id", id)
    .select("id, category_edited")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ memo: { ...data, category: trimmed }, copied: false });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase.from("memos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
