import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/adminClient";
import { ai } from "@/lib/ai";

/** KST(UTC+9) 기준 YYYY-MM-DD. */
function kstDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * PRD 7.7 "밤 배치" 감정 자동 태깅. 매일 새벽(KST) Vercel Cron이 호출해서, 막 끝난 전날 하루치
 * 메모를 사용자별로 모아 AI에게 대표 감정을 물어보고 emotion_entries에 채운다.
 * 직접 입력(manual)이 이미 있으면 절대 덮어쓰지 않는다 (PRD: 직접 입력 우선).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const targetDate = kstDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const { data: memos } = await supabase
    .from("memos")
    .select("user_id, content, summary")
    .gte("created_at", `${targetDate}T00:00:00+09:00`)
    .lte("created_at", `${targetDate}T23:59:59.999+09:00`);

  const byUser = new Map<string, string[]>();
  for (const memo of memos ?? []) {
    const userId = memo.user_id as string | null;
    if (!userId) continue;
    const texts = byUser.get(userId) ?? [];
    texts.push((memo.summary as string | null) ?? (memo.content as string));
    byUser.set(userId, texts);
  }

  let tagged = 0;
  for (const [userId, texts] of byUser) {
    const emotion = await ai.tagDailyEmotion(texts);
    if (!emotion) continue;

    const { data: existing } = await supabase
      .from("emotion_entries")
      .select("id, source")
      .eq("user_id", userId)
      .eq("entry_date", targetDate)
      .maybeSingle();

    if (existing?.source === "manual") continue;

    if (existing) {
      await supabase
        .from("emotion_entries")
        .update({ emotion, source: "auto", updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("emotion_entries").insert({ user_id: userId, entry_date: targetDate, emotion, source: "auto" });
    }
    tagged++;
  }

  return NextResponse.json({ date: targetDate, users: byUser.size, tagged });
}
