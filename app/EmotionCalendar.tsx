"use client";

import { useEffect, useState } from "react";
import { EMOTIONS, emojiFor, characterFor } from "@/lib/emotions";
import { kstDateString } from "@/lib/kstDate";

type EntryRow = { entry_date: string; emotion: string; source: "auto" | "manual" };
type DayMemo = { id: string; content: string; summary: string | null; created_at: string; category: string | null };
type DayEvent = { id: string; content: string; summary: string | null; remind_day_before: boolean; category: string | null };

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** PRD 7.7 / C-1~C-3: 월간 뷰(빈 날 허용) → 날짜 탭하면 그날 감정 + 메모, 감정은 직접 입력으로 덮어쓸 수 있음. */
export default function EmotionCalendar() {
  const [cursor, setCursor] = useState(() => new Date());
  const [entries, setEntries] = useState<Map<string, EntryRow>>(new Map());
  const [eventDates, setEventDates] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayEntry, setDayEntry] = useState<EntryRow | null>(null);
  const [dayMemos, setDayMemos] = useState<DayMemo[]>([]);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedMemoIds, setExpandedMemoIds] = useState<Set<string>>(new Set());

  async function loadMonth(d: Date) {
    setLoading(true);
    try {
      const res = await fetch(`/api/emotions?month=${toMonthKey(d)}`);
      if (!res.ok) return;
      const { entries: rows, eventDates: eventDateRows, streak: streakCount } = (await res.json()) as {
        entries: EntryRow[];
        eventDates: string[];
        streak: number;
      };
      setEntries(new Map(rows.map((r) => [r.entry_date, r])));
      setEventDates(new Set(eventDateRows));
      setStreak(streakCount);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMonth(cursor);
  }, [cursor]);

  async function openDay(dateKey: string) {
    setSelectedDate(dateKey);
    setDayLoading(true);
    setExpandedMemoIds(new Set());
    try {
      const res = await fetch(`/api/emotions?date=${dateKey}`);
      if (!res.ok) return;
      const { entry, memos, events } = await res.json();
      setDayEntry(entry);
      setDayMemos(memos);
      setDayEvents(events);
    } finally {
      setDayLoading(false);
    }
  }

  function closeDay() {
    setSelectedDate(null);
    setDayEntry(null);
    setDayMemos([]);
    setDayEvents([]);
    setExpandedMemoIds(new Set());
  }

  // 원문 펼치기(넣기 화면과 같은 패턴) — 펼친 순간이 "열람"이라 서버에도 알려준다.
  function toggleMemoExpand(id: string) {
    setExpandedMemoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        fetch(`/api/memos/${id}/view`, { method: "POST" }).catch(() => {});
      }
      return next;
    });
  }

  // 누르는 즉시 화면부터 바꾸고(체감 속도), 저장은 뒤에서 진행해서 실패할 때만 되돌린다.
  async function setEmotion(emotion: string) {
    if (!selectedDate) return;
    const previousEntry = dayEntry;
    const optimistic: EntryRow = { entry_date: selectedDate, emotion, source: "manual" };
    setDayEntry(optimistic);
    setEntries((prev) => new Map(prev).set(selectedDate, optimistic));
    setSaving(true);
    try {
      const res = await fetch("/api/emotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, emotion }),
      });
      if (!res.ok) throw new Error("저장 실패");
    } catch {
      setDayEntry(previousEntry);
      setEntries((prev) => {
        const next = new Map(prev);
        if (previousEntry) next.set(selectedDate, previousEntry);
        else next.delete(selectedDate);
        return next;
      });
    } finally {
      setSaving(false);
    }
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayKey = kstDateString();

  return (
    <section className="rounded-lg border border-hairline bg-canvas p-6 shadow-[var(--shadow-1)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-ink">감정 캘린더</h2>
          {streak >= 2 && <span className="text-xs text-muted">{streak}일째 툭 던지는 중</span>}
        </div>
        <div className="flex items-center gap-3 text-sm text-steel">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="이전 달">
            ‹
          </button>
          <span className="tabular-nums text-ink">
            {year}년 {month + 1}월
          </span>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="다음 달">
            ›
          </button>
        </div>
      </div>

      <p className="mb-2 text-xs text-steel">
        이번 달 {entries.size}일 기록했어요
      </p>
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
        {EMOTIONS.map((e) => (
          <span key={e.key} className="flex items-center gap-1 text-[11px] text-muted">
            <span className="text-sm leading-none">{e.emoji}</span>
            {e.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className={`mt-1 grid grid-cols-7 gap-1 ${loading ? "opacity-50" : ""}`}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateKey = toDateKey(year, month, day);
          const entry = entries.get(dateKey);
          const hasEvent = eventDates.has(dateKey);
          const isToday = dateKey === todayKey;
          return (
            <button
              key={dateKey}
              onClick={() => openDay(dateKey)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-md text-xs text-ink hover:bg-surface ${
                isToday ? "bg-primary/10 ring-1 ring-inset ring-primary" : ""
              }`}
            >
              <span className={`text-[10px] ${isToday ? "font-bold text-primary" : "text-muted"}`}>{day}</span>
              <span className="text-base leading-none">{entry ? emojiFor(entry.emotion) : ""}</span>
              {hasEvent && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/40 px-4"
          onClick={closeDay}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[24rem] flex-col rounded-lg bg-canvas p-6 shadow-[var(--shadow-4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-ink">{selectedDate}</h3>
              <button onClick={closeDay} className="text-sm text-steel" aria-label="닫기">
                닫기
              </button>
            </div>

            {dayEntry && (
              <div className="mb-3 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={characterFor(dayEntry.emotion) ?? undefined} alt="" className="h-28 w-28" />
              </div>
            )}

            <div className="mb-4 flex items-center gap-2">
              {EMOTIONS.map((e) => (
                <button
                  key={e.key}
                  onClick={() => setEmotion(e.key)}
                  disabled={saving}
                  title={e.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${
                    dayEntry?.emotion === e.key ? "bg-primary/20 ring-2 ring-primary" : "bg-surface"
                  }`}
                >
                  {e.emoji}
                </button>
              ))}
            </div>
            {dayEntry?.source === "auto" && (
              <p className="mb-3 -mt-2 text-xs text-muted">자동으로 태깅됨 — 다르면 위에서 직접 골라주세요</p>
            )}

            <div className="flex-1 overflow-y-auto">
              {!dayLoading && dayEvents.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-steel">📅 이날 일정</p>
                  <div className="flex flex-col gap-2">
                    {dayEvents.map((ev) => (
                      <div key={ev.id} className="rounded-lg border border-primary/40 bg-surface p-3">
                        <p className="text-sm text-ink">{ev.summary ?? ev.content}</p>
                        <p className="mt-1 text-xs text-muted">
                          {ev.category}
                          {ev.remind_day_before && " · 🔔 하루 전 알림"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dayLoading ? (
                <p className="text-sm text-steel">불러오는 중...</p>
              ) : dayMemos.length === 0 ? (
                <p className="text-sm text-steel">이날 저장한 메모가 없어요.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dayMemos.map((m) => (
                    <div key={m.id} className="rounded-lg border border-hairline p-3">
                      <p
                        className={m.summary ? "cursor-pointer text-sm text-ink" : "text-sm text-ink"}
                        onClick={m.summary ? () => toggleMemoExpand(m.id) : undefined}
                      >
                        {m.summary ?? m.content}
                      </p>
                      {m.summary && expandedMemoIds.has(m.id) && (
                        <p className="mt-2 whitespace-pre-line border-t border-hairline pt-2 text-sm text-steel">
                          {m.content}
                        </p>
                      )}
                      {m.category && <p className="mt-1 text-xs text-muted">{m.category}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
