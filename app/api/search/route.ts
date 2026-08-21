import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/serverClient";

type MatchRow = {
  id: string;
  content: string;
  summary: string | null;
  category: string | null;
  category_edited: boolean;
  source: string;
  created_at: string;
  similarity: number;
};

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const query = params.get("q");
  const thresholdA = Number(params.get("a") ?? "0.72");
  const thresholdB = Number(params.get("b") ?? "0.55");

  if (!query || !query.trim()) {
    return NextResponse.json({ error: "q가 비어있습니다" }, { status: 400 });
  }

  const embedding = await ai.embed(query, "RETRIEVAL_QUERY");

  // 1단계: 벡터 검색으로 폭넓게 후보를 추린다 (재현율 우선, 임계값은 낮게 — 최종 판단은 2단계에서 함)
  const { data, error } = await supabase.rpc("match_memos", {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: 20,
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as MatchRow[];
  if (rows.length === 0) {
    return NextResponse.json({ certain: [], maybe: [] });
  }

  // 2단계: 후보를 LLM으로 재채점한다 (정밀도 우선). 실패하면 코사인 유사도로 그대로 감.
  let scored = rows;
  try {
    const scores = await ai.rerank(
      query,
      rows.map((r) => r.summary || r.content)
    );
    scored = rows.map((r, i) => ({ ...r, similarity: scores[i] }));
  } catch {
    // 재랭킹 실패 시 1단계 코사인 유사도를 그대로 사용
  }

  const certain = scored.filter((r) => r.similarity >= thresholdA);
  const maybe = scored.filter((r) => r.similarity >= thresholdB && r.similarity < thresholdA);

  return NextResponse.json({ certain, maybe });
}
