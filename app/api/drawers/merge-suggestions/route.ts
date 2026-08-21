import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/serverClient";
import type { MemoRow } from "@/lib/supabase/types";

/** PRD 7.5 과분할 방지: 현재 서랍 목록을 보고 병합할 만한 것들을 LLM이 제안한다. */
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { data, error } = await supabase
    .from("memos")
    .select("category")
    .not("category", "is", null)
    .returns<Pick<MemoRow, "category">[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const category = row.category as string;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const categories = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  if (categories.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await ai.suggestMerges(categories);
  return NextResponse.json({ suggestions });
}
