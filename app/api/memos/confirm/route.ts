import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";
import { findOrCreateDrawerId } from "@/lib/drawers";
import { takePendingDraft } from "@/lib/pendingDrafts";

export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { draftId, categories, alsoMoveIds, eventDate, remindDayBefore } = await request.json();

  const finalCategories = Array.isArray(categories)
    ? Array.from(new Set(categories.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean)))
    : [];

  if (typeof draftId !== "string" || finalCategories.length === 0) {
    return NextResponse.json({ error: "draftId, categories가 필요합니다" }, { status: 400 });
  }

  const draft = takePendingDraft(draftId);
  if (!draft) {
    return NextResponse.json({ error: "만료되었거나 존재하지 않는 초안입니다" }, { status: 404 });
  }

  // 캘린더에 추가할지도 항상 사용자 확인을 거친 뒤에만 반영한다 (AI가 일정을 감지해도 자동 반영 안 함)
  const useEventDate = typeof eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : null;
  const useRemindDayBefore = useEventDate !== null && remindDayBefore === true;

  // 카테고리 개수만큼 같은 내용의 메모를 각각 저장한다 (예: 감정 + 일기 둘 다 저장). 순서를 category와
  // 확실히 맞추려고 하나씩 insert한다 (많아야 2개라 성능 문제 없음).
  const created: { id: string; content: string; summary: string | null; category: string; source: string; created_at: string }[] = [];
  for (const category of finalCategories) {
    const drawerId = await findOrCreateDrawerId(supabase, user.id, user.email ?? "", category);
    const { data, error } = await supabase
      .from("memos")
      .insert({
        content: draft.content,
        summary: draft.summary,
        embedding: draft.embedding,
        drawer_id: drawerId,
        // 사용자가 제안된 후보 중 하나를 그대로 골랐다면 수정으로 안 침
        category_edited: !draft.candidateCategories.includes(category),
        source: draft.source,
        user_id: user.id,
        event_date: useEventDate,
        remind_day_before: useRemindDayBefore,
      })
      .select("id, content, summary, source, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    created.push({ ...data, category });
  }

  let movedCount = 0;
  const primaryDrawerId = await findOrCreateDrawerId(supabase, user.id, user.email ?? "", finalCategories[0]);
  if (Array.isArray(alsoMoveIds) && alsoMoveIds.length > 0) {
    const { data: moved, error: moveError } = await supabase
      .from("memos")
      .update({ drawer_id: primaryDrawerId, category_edited: true })
      .in("id", alsoMoveIds)
      .select("id");
    if (!moveError) movedCount = moved?.length ?? 0;
  }

  // 9/10번: 저장 리액션을 공동 서랍 여부에 따라 다르게 고르기 위한 정보.
  // shared = 이 서랍 멤버가 2명 이상, telepathy = 최근 24시간 안에 나 아닌 다른 멤버도 저장했음.
  const { count: memberCount } = await supabase
    .from("drawer_members")
    .select("id", { count: "exact", head: true })
    .eq("drawer_id", primaryDrawerId)
    .eq("status", "accepted");
  const shared = (memberCount ?? 1) > 1;
  let telepathy = false;
  if (shared) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOthers } = await supabase
      .from("memos")
      .select("id")
      .eq("drawer_id", primaryDrawerId)
      .neq("user_id", user.id)
      .gte("created_at", dayAgo)
      .limit(1);
    telepathy = (recentOthers?.length ?? 0) > 0;
  }

  return NextResponse.json({ memos: created, movedCount, collab: { shared, telepathy } });
}
