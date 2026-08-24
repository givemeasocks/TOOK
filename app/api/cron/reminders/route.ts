import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/adminClient";
import { sendPush } from "@/lib/webPush";

const DAY_MS = 24 * 60 * 60 * 1000;
const DORMANT_AFTER_MS = 30 * DAY_MS;
const DORMANT_WEEKLY_CAP = 2;
const CLUSTER_MIN_SIZE = 5;
const CLUSTER_WEEKLY_CAP = 1;

type Reminder = { kind: "dormant" | "cluster"; drawerId: string | null; memoId: string | null; body: string };

/** 이 유저가 멤버로 있는 서랍 id 목록. */
async function memberDrawerIds(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("drawer_members")
    .select("drawer_id")
    .eq("user_id", userId)
    .eq("status", "accepted");
  return (data ?? []).map((r) => r.drawer_id as string);
}

async function findClusterCandidate(supabase: SupabaseClient, userId: string): Promise<Reminder | null> {
  const drawerIds = await memberDrawerIds(supabase, userId);
  if (drawerIds.length === 0) return null;

  const { data: unviewed } = await supabase
    .from("memos")
    .select("drawer_id")
    .in("drawer_id", drawerIds)
    .is("viewed_at", null);

  const counts = new Map<string, number>();
  for (const row of unviewed ?? []) {
    const id = row.drawer_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  let best: { drawerId: string; count: number } | null = null;
  for (const [drawerId, count] of counts) {
    if (count >= CLUSTER_MIN_SIZE && (!best || count > best.count)) best = { drawerId, count };
  }
  if (!best) return null;

  const { data: drawer } = await supabase.from("drawers").select("name").eq("id", best.drawerId).single();
  if (!drawer) return null;

  return {
    kind: "cluster",
    drawerId: best.drawerId,
    memoId: null,
    body: `'${drawer.name}' ${best.count}개가 모였어요`,
  };
}

async function findDormantCandidate(supabase: SupabaseClient, userId: string): Promise<Reminder | null> {
  const drawerIds = await memberDrawerIds(supabase, userId);
  if (drawerIds.length === 0) return null;

  const cutoff = new Date(Date.now() - DORMANT_AFTER_MS).toISOString();
  const { data } = await supabase
    .from("memos")
    .select("id, summary, content")
    .in("drawer_id", drawerIds)
    .is("viewed_at", null)
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(1);

  const memo = data?.[0];
  if (!memo) return null;

  const text = (memo.summary as string | null) ?? (memo.content as string).slice(0, 30);
  return {
    kind: "dormant",
    drawerId: null,
    memoId: memo.id as string,
    body: `${text}, 지금 필요하지 않아요?`,
  };
}

async function countSince(supabase: SupabaseClient, userId: string, sinceIso: string, kind?: "dormant" | "cluster") {
  let query = supabase
    .from("reminder_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  if (kind) query = query.eq("kind", kind);
  const { count } = await query;
  return count ?? 0;
}

/** PRD 7.6: 전체 하루 1건, 묵혀둔 것 주 2회 / 군집 주 1회 상한. 군집을 더 강한 신호로 보고 먼저 확인한다. */
async function pickReminder(supabase: SupabaseClient, userId: string): Promise<Reminder | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sentToday = await countSince(supabase, userId, todayStart.toISOString());
  if (sentToday > 0) return null;

  const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();

  const clusterThisWeek = await countSince(supabase, userId, weekAgo, "cluster");
  if (clusterThisWeek < CLUSTER_WEEKLY_CAP) {
    const cluster = await findClusterCandidate(supabase, userId);
    if (cluster) return cluster;
  }

  const dormantThisWeek = await countSince(supabase, userId, weekAgo, "dormant");
  if (dormantThisWeek < DORMANT_WEEKLY_CAP) {
    const dormant = await findDormantCandidate(supabase, userId);
    if (dormant) return dormant;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: subRows } = await supabase.from("push_subscriptions").select("user_id");
  const userIds = Array.from(new Set((subRows ?? []).map((r) => r.user_id as string)));

  let sent = 0;
  for (const userId of userIds) {
    const reminder = await pickReminder(supabase, userId);
    if (!reminder) continue;

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    for (const sub of subscriptions ?? []) {
      try {
        await sendPush(sub, { title: "TOOK", body: reminder.body, url: "/" });
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    await supabase.from("reminder_logs").insert({
      user_id: userId,
      kind: reminder.kind,
      drawer_id: reminder.drawerId,
      memo_id: reminder.memoId,
    });
    sent++;
  }

  return NextResponse.json({ users: userIds.length, sent });
}
