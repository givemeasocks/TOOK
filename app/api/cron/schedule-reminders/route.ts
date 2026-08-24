import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/adminClient";
import { sendPush } from "@/lib/webPush";
import { kstDateString } from "@/lib/kstDate";

/**
 * 사용자가 "하루 전에 알려드릴까요?"에 동의한 일정 메모를 하루 전날 밤(KST) 푸시로 알려준다.
 * 리마인드(cron/reminders)의 하루 1건 상한과는 별개 — 사용자가 명시적으로 요청한 알림이라 그 상한을 안 씀.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const tomorrow = kstDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const { data: memos } = await supabase
    .from("memos")
    .select("id, user_id, summary, content")
    .eq("event_date", tomorrow)
    .eq("remind_day_before", true)
    .eq("schedule_reminder_sent", false);

  let sent = 0;
  for (const memo of memos ?? []) {
    const userId = memo.user_id as string | null;
    if (userId) {
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId);

      const text = (memo.summary as string | null) ?? (memo.content as string).slice(0, 30);
      for (const sub of subscriptions ?? []) {
        try {
          await sendPush(sub, { title: "TOOK", body: `내일 '${text}' 일정이 있어요`, url: "/" });
          sent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }
    }

    await supabase.from("memos").update({ schedule_reminder_sent: true }).eq("id", memo.id as string);
  }

  return NextResponse.json({ date: tomorrow, memos: memos?.length ?? 0, sent });
}
