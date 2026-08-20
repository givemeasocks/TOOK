import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MemoRow } from "@/lib/supabase/types";
import { savePendingDraft } from "@/lib/pendingDrafts";

async function getExistingCategories(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: categoryRows } = await supabase
    .from("memos")
    .select("category")
    .not("category", "is", null)
    .returns<Pick<MemoRow, "category">[]>();
  return Array.from(new Set((categoryRows ?? []).map((r) => r.category as string)));
}

export async function POST(request: NextRequest) {
  const { content, source = "manual" } = await request.json();

  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content가 비어있습니다" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const existingCategories = await getExistingCategories(supabase);

  const [summary, embedding, category] = await Promise.all([
    ai.summarize(content),
    ai.embed(content),
    ai.classify(content, existingCategories),
  ]);

  // 기존에 없던 카테고리를 새로 만들려는 경우, 바로 저장하지 않고 사용자 확인을 받는다
  if (!existingCategories.includes(category)) {
    const draftId = savePendingDraft({ content, summary, embedding, proposedCategory: category, source });

    // 의미적으로 비슷한 기존 메모도 같이 옮길지 물어보기 위해 후보를 찾아둔다
    // 임계값을 search API보다 높게 잡음: 잘못된 제안으로 사용자가 엉뚱한 메모를 옮기지 않도록 방어
    const { data: similar } = await supabase.rpc("match_memos", {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 6,
    });
    const suggestedMemos = ((similar ?? []) as { id: string; summary: string; category: string; similarity: number }[])
      .filter((m) => m.category && m.category !== category)
      .slice(0, 5);

    return NextResponse.json({
      pending: true,
      draftId,
      proposedCategory: category,
      summary,
      existingCategories,
      suggestedMemos,
    });
  }

  const { data, error } = await supabase
    .from("memos")
    .insert({ content, summary, embedding, category, source })
    .select("id, content, summary, category, source, created_at")
    .returns<Pick<MemoRow, "id" | "content" | "summary" | "category" | "source" | "created_at">[]>()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ memo: data });
}

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("memos")
    .select("id, content, summary, category, category_edited, source, created_at")
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);

  const { data, error } = await query.returns<MemoRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ memos: data });
}
