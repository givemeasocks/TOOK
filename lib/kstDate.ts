/** KST(UTC+9) 기준 YYYY-MM-DD. */
export function kstDateString(date: Date = new Date()): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
