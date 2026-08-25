import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ai } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/serverClient";
import { findDrawerIdByName, listMemberDrawers } from "@/lib/drawers";
import { savePendingDraft } from "@/lib/pendingDrafts";
import { kstDateString } from "@/lib/kstDate";

async function getExistingCategories(supabase: SupabaseClient, userId: string) {
  const drawers = await listMemberDrawers(supabase, userId);
  return Array.from(new Set(drawers.map((d) => d.name)));
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { content } = await request.json();
  const source = "manual" as const;

  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content가 비어있습니다" }, { status: 400 });
  }

  const existingCategories = await getExistingCategories(supabase, user.id);

  const [summary, embedding, categories, schedule] = await Promise.all([
    ai.summarize(content),
    ai.embed(content, "RETRIEVAL_DOCUMENT"),
    ai.classify(content, existingCategories),
    ai.extractSchedule(content, kstDateString()),
  ]);

  // AI가 어디로 분류했든, 실제로 그 서랍에 넣기 전에 항상 사용자 확인을 받는다
  const draftId = savePendingDraft({ content, summary, embedding, candidateCategories: categories, source });

  // 의미적으로 비슷한 기존 메모도 같이 옮길지 물어보기 위해 후보를 찾아둔다 (새 서랍 생성 케이스에서만)
  // 임계값을 search API보다 높게 잡음: 잘못된 제안으로 사용자가 엉뚱한 메모를 옮기지 않도록 방어
  let suggestedMemos: { id: string; summary: string; category: string; similarity: number }[] = [];
  if (categories.length === 1 && !existingCategories.includes(categories[0])) {
    const { data: similar } = await supabase.rpc("match_memos", {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 6,
      p_user_id: user.id,
    });
    suggestedMemos = ((similar ?? []) as { id: string; summary: string; category: string; similarity: number }[])
      .filter((m) => m.category && m.category !== categories[0])
      .slice(0, 5);
  }

  return NextResponse.json({
    pending: true,
    draftId,
    candidateCategories: categories,
    summary,
    existingCategories,
    suggestedMemos,
    schedule,
  });
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const category = request.nextUrl.searchParams.get("category");
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 0, 1), 50) : null;

  let drawerId: string | null = null;
  if (category) {
    drawerId = await findDrawerIdByName(supabase, user.id, category);
    if (!drawerId) return NextResponse.json({ memos: [] });
  }

  let query = supabase
    .from("memos")
    .select("id, content, summary, category_edited, source, created_at, user_id, drawer:drawers(name)")
    .order("created_at", { ascending: false });

  if (drawerId) query = query.eq("drawer_id", drawerId);
  if (limit) query = query.limit(limit);

  const { data, error } = await query.returns<
    { id: string; content: string; summary: string | null; category_edited: boolean; source: string; created_at: string; user_id: string | null; drawer: { name: string } | null }[]
  >();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const memos = (data ?? []).map(({ drawer, ...rest }) => ({ ...rest, category: drawer?.name ?? null }));
  return NextResponse.json({ memos });
}
