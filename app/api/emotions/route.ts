import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";
import { isEmotionKey } from "@/lib/emotions";

function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const month = request.nextUrl.searchParams.get("month"); // YYYY-MM
  const date = request.nextUrl.searchParams.get("date"); // YYYY-MM-DD

  if (date) {
    const { data: entry } = await supabase
      .from("emotion_entries")
      .select("emotion, source")
      .eq("user_id", user.id)
      .eq("entry_date", date)
      .maybeSingle();

    const { data: memos, error } = await supabase
      .from("memos")
      .select("id, content, summary, created_at, drawer:drawers(name)")
      .eq("user_id", user.id)
      .gte("created_at", `${date}T00:00:00+09:00`)
      .lte("created_at", `${date}T23:59:59.999+09:00`)
      .order("created_at", { ascending: true })
      .returns<
        { id: string; content: string; summary: string | null; created_at: string; drawer: { name: string } | null }[]
      >();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      entry: entry ?? null,
      memos: (memos ?? []).map(({ drawer, ...rest }) => ({ ...rest, category: drawer?.name ?? null })),
    });
  }

  if (month) {
    const { data, error } = await supabase
      .from("emotion_entries")
      .select("entry_date, emotion, source")
      .eq("user_id", user.id)
      .gte("entry_date", `${month}-01`)
      .lt("entry_date", nextMonthStart(month));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ entries: data ?? [] });
  }

  return NextResponse.json({ error: "month 또는 date가 필요합니다" }, { status: 400 });
}

/** 직접 입력(PRD C-3). 그날 자동 태깅된 게 있어도 직접 입력이 항상 우선한다. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { date, emotion } = await request.json();
  if (typeof date !== "string" || !isEmotionKey(emotion)) {
    return NextResponse.json({ error: "date, emotion이 필요합니다" }, { status: 400 });
  }

  const { error } = await supabase
    .from("emotion_entries")
    .upsert(
      { user_id: user.id, entry_date: date, emotion, source: "manual", updated_at: new Date().toISOString() },
      { onConflict: "user_id,entry_date" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
