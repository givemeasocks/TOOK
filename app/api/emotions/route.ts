import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";
import { isEmotionKey } from "@/lib/emotions";
import { computeStreak, kstDateString, kstDateStringDaysAgo } from "@/lib/kstDate";

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

    const [{ data: memos, error }, { data: events, error: eventsError }] = await Promise.all([
      supabase
        .from("memos")
        .select("id, content, summary, created_at, drawer:drawers(name)")
        .eq("user_id", user.id)
        .gte("created_at", `${date}T00:00:00+09:00`)
        .lte("created_at", `${date}T23:59:59.999+09:00`)
        .order("created_at", { ascending: true })
        .returns<
          { id: string; content: string; summary: string | null; created_at: string; drawer: { name: string } | null }[]
        >(),
      // 그날 "쓴" 메모가 아니라 그날이 "일정인" 메모 — 예: 오늘 적은 메모가 다음달 일정을 가리키는 경우
      supabase
        .from("memos")
        .select("id, summary, content, remind_day_before, drawer:drawers(name)")
        .eq("user_id", user.id)
        .eq("event_date", date)
        .returns<
          { id: string; summary: string | null; content: string; remind_day_before: boolean; drawer: { name: string } | null }[]
        >(),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    return NextResponse.json({
      entry: entry ?? null,
      memos: (memos ?? []).map(({ drawer, ...rest }) => ({ ...rest, category: drawer?.name ?? null })),
      events: (events ?? []).map(({ drawer, ...rest }) => ({ ...rest, category: drawer?.name ?? null })),
    });
  }

  if (month) {
    const streakWindowStart = kstDateStringDaysAgo(365);
    const [
      { data, error },
      { data: eventDates, error: eventDatesError },
      { data: streakEntries, error: streakEntriesError },
      { data: streakMemos, error: streakMemosError },
    ] = await Promise.all([
      supabase
        .from("emotion_entries")
        .select("entry_date, emotion, source")
        .eq("user_id", user.id)
        .gte("entry_date", `${month}-01`)
        .lt("entry_date", nextMonthStart(month)),
      supabase
        .from("memos")
        .select("event_date")
        .eq("user_id", user.id)
        .gte("event_date", `${month}-01`)
        .lt("event_date", nextMonthStart(month)),
      // 스트릭 계산용 — 최근 1년치 감정 기록일
      supabase
        .from("emotion_entries")
        .select("entry_date")
        .eq("user_id", user.id)
        .gte("entry_date", streakWindowStart),
      // 스트릭 계산용 — 최근 1년치 메모 작성일 (KST 기준으로 날짜만 뽑아서 씀)
      supabase
        .from("memos")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", `${streakWindowStart}T00:00:00+09:00`),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (eventDatesError) {
      return NextResponse.json({ error: eventDatesError.message }, { status: 500 });
    }
    if (streakEntriesError) {
      return NextResponse.json({ error: streakEntriesError.message }, { status: 500 });
    }
    if (streakMemosError) {
      return NextResponse.json({ error: streakMemosError.message }, { status: 500 });
    }

    const activeDates = new Set<string>([
      ...(streakEntries ?? []).map((r) => r.entry_date as string),
      ...(streakMemos ?? []).map((r) => kstDateString(new Date(r.created_at as string))),
    ]);

    return NextResponse.json({
      entries: data ?? [],
      eventDates: Array.from(new Set((eventDates ?? []).map((r) => r.event_date as string))),
      streak: computeStreak(activeDates),
    });
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
