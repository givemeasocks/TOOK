/** KST(UTC+9) 기준 YYYY-MM-DD. */
export function kstDateString(date: Date = new Date()): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** KST 기준으로 n일 전 YYYY-MM-DD. */
export function kstDateStringDaysAgo(days: number, from: Date = new Date()): string {
  return kstDateString(new Date(from.getTime() - days * 24 * 60 * 60 * 1000));
}

/**
 * 오늘(KST)부터 거꾸로 훑으면서 dates에 있는 날이 끊기지 않고 이어지는 일수를 센다.
 * 오늘 기록이 아직 없으면 어제부터 셈 — "아직 오늘 안 썼다고 스트릭이 0으로 뚝 끊기는" 느낌을 피하기 위함.
 */
export function computeStreak(dates: Set<string>, from: Date = new Date()): number {
  let streak = 0;
  let cursor = from;
  if (!dates.has(kstDateString(cursor))) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  while (dates.has(kstDateString(cursor)) && streak < 365) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}
