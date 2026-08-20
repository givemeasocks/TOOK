import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

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
  const params = request.nextUrl.searchParams;
  const query = params.get("q");
  const thresholdA = Number(params.get("a") ?? "0.72");
  const thresholdB = Number(params.get("b") ?? "0.55");

  if (!query || !query.trim()) {
    return NextResponse.json({ error: "q가 비어있습니다" }, { status: 400 });
  }

  const embedding = await ai.embed(query);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("match_memos", {
    query_embedding: embedding,
    match_threshold: thresholdB,
    match_count: 50,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as MatchRow[];
  const certain = rows.filter((r) => r.similarity >= thresholdA);
  const maybe = rows.filter((r) => r.similarity >= thresholdB && r.similarity < thresholdA);

  return NextResponse.json({ certain, maybe });
}
