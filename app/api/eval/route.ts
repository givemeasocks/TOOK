import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { query, memo_id, relevant, similarity } = await request.json();

  if (typeof query !== "string" || typeof memo_id !== "string" || typeof relevant !== "boolean") {
    return NextResponse.json({ error: "query, memo_id, relevant가 필요합니다" }, { status: 400 });
  }

  const { error } = await supabase
    .from("eval_logs")
    .insert({ query, memo_id, relevant, similarity: similarity ?? null, user_id: user.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

type EvalLog = { query: string; relevant: boolean; similarity: number | null };

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const [{ data: logs, error: logsError }, { data: memos, error: memosError }] = await Promise.all([
    supabase.from("eval_logs").select("query, relevant, similarity"),
    supabase.from("memos").select("category_edited").not("category", "is", null),
  ]);

  if (logsError) return NextResponse.json({ error: logsError.message }, { status: 500 });
  if (memosError) return NextResponse.json({ error: memosError.message }, { status: 500 });

  const evalLogs = (logs ?? []) as EvalLog[];
  const thumbsUp = evalLogs.filter((l) => l.relevant).length;
  const totalJudged = evalLogs.length;
  // 재현율(A.6): 판정된 것 중 실제 관련 있다고 확인된 비율. 참 재현율은 정답셋(수동 태깅)이 있어야 정확함 — v0에서는 판정 결과로 근사.
  const recall = totalJudged > 0 ? thumbsUp / totalJudged : null;

  // 오탐률: 쿼리별로 유사도 상위 5개 중 👎 비율을 구해 평균
  const byQuery = new Map<string, EvalLog[]>();
  for (const log of evalLogs) {
    if (!byQuery.has(log.query)) byQuery.set(log.query, []);
    byQuery.get(log.query)!.push(log);
  }
  const perQueryFalsePositiveRates: number[] = [];
  for (const queryLogs of byQuery.values()) {
    const top5 = [...queryLogs]
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, 5);
    if (top5.length === 0) continue;
    const falsePositives = top5.filter((l) => !l.relevant).length;
    perQueryFalsePositiveRates.push(falsePositives / top5.length);
  }
  const falsePositiveRate =
    perQueryFalsePositiveRates.length > 0
      ? perQueryFalsePositiveRates.reduce((a, b) => a + b, 0) / perQueryFalsePositiveRates.length
      : null;

  const categorizedMemos = memos ?? [];
  const classificationAccuracy =
    categorizedMemos.length > 0
      ? categorizedMemos.filter((m) => !m.category_edited).length / categorizedMemos.length
      : null;

  return NextResponse.json({ recall, falsePositiveRate, classificationAccuracy, totalJudged });
}
