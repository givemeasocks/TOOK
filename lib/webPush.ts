import "server-only";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };

/** 만료/무효 구독이면 statusCode 404/410로 던져지므로, 호출부에서 잡아서 구독을 지우면 된다. */
export async function sendPush(sub: PushSubscriptionRow, payload: { title: string; body: string; url: string }) {
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload)
  );
}
