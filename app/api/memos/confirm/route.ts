import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MemoRow } from "@/lib/supabase/types";
import { takePendingDraft } from "@/lib/pendingDrafts";

export async function POST(request: NextRequest) {
  const { draftId, category, alsoMoveIds } = await request.json();

  if (typeof draftId !== "string" || typeof category !== "string" || !category.trim()) {
    return NextResponse.json({ error: "draftId, category가 필요합니다" }, { status: 400 });
  }

  const draft = takePendingDraft(draftId);
  if (!draft) {
    return NextResponse.json({ error: "만료되었거나 존재하지 않는 초안입니다" }, { status: 404 });
  }

  const finalCategory = category.trim();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("memos")
    .insert({
      content: draft.content,
      summary: draft.summary,
      embedding: draft.embedding,
      category: finalCategory,
      // 사용자가 제안된 것과 다른 카테고리를 골랐다면 수정으로 취급
      category_edited: finalCategory !== draft.proposedCategory,
      source: draft.source,
    })
    .select("id, content, summary, category, source, created_at")
    .returns<Pick<MemoRow, "id" | "content" | "summary" | "category" | "source" | "created_at">[]>()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let movedCount = 0;
  if (Array.isArray(alsoMoveIds) && alsoMoveIds.length > 0) {
    const { data: moved, error: moveError } = await supabase
      .from("memos")
      .update({ category: finalCategory, category_edited: true })
      .in("id", alsoMoveIds)
      .select("id");
    if (!moveError) movedCount = moved?.length ?? 0;
  }

  return NextResponse.json({ memo: data, movedCount });
}
