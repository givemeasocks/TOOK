import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/serverClient";

/**
 * 임베딩 모델/차원/taskType을 바꾼 뒤 기존 메모를 일괄 재임베딩할 때 쓴다.
 * (PRD 8.3: Gemini 모델은 주기적으로 교체되므로 재임베딩 경로가 계속 필요함)
 * 로그인한 사용자 본인 메모만 다시 임베딩한다.
 */
export async function POST() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { data: memos, error } = await supabase.from("memos").select("id, content");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  for (const memo of memos ?? []) {
    const embedding = await ai.embed(memo.content as string, "RETRIEVAL_DOCUMENT");
    const { error: updateError } = await supabase
      .from("memos")
      .update({ embedding })
      .eq("id", memo.id as string);
    if (!updateError) updated += 1;
  }

  return NextResponse.json({ total: memos?.length ?? 0, updated });
}
