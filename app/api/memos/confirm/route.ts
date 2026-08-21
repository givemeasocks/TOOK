import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";
import type { MemoRow } from "@/lib/supabase/types";
import { takePendingDraft } from "@/lib/pendingDrafts";

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { draftId, categories, alsoMoveIds } = await request.json();

  const finalCategories = Array.isArray(categories)
    ? Array.from(new Set(categories.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean)))
    : [];

  if (typeof draftId !== "string" || finalCategories.length === 0) {
    return NextResponse.json({ error: "draftId, categories가 필요합니다" }, { status: 400 });
  }

  const draft = takePendingDraft(draftId);
  if (!draft) {
    return NextResponse.json({ error: "만료되었거나 존재하지 않는 초안입니다" }, { status: 404 });
  }

  // 카테고리 개수만큼 같은 내용의 메모를 각각 저장한다 (예: 감정 + 일기 둘 다 저장)
  const { data, error } = await supabase
    .from("memos")
    .insert(
      finalCategories.map((category) => ({
        content: draft.content,
        summary: draft.summary,
        embedding: draft.embedding,
        category,
        // 사용자가 제안된 후보 중 하나를 그대로 골랐다면 수정으로 안 침
        category_edited: !draft.candidateCategories.includes(category),
        source: draft.source,
        user_id: user.id,
      }))
    )
    .select("id, content, summary, category, source, created_at")
    .returns<Pick<MemoRow, "id" | "content" | "summary" | "category" | "source" | "created_at">[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let movedCount = 0;
  if (Array.isArray(alsoMoveIds) && alsoMoveIds.length > 0) {
    const { data: moved, error: moveError } = await supabase
      .from("memos")
      .update({ category: finalCategories[0], category_edited: true })
      .in("id", alsoMoveIds)
      .select("id");
    if (!moveError) movedCount = moved?.length ?? 0;
  }

  return NextResponse.json({ memos: data, movedCount });
}
