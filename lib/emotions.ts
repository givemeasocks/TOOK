// PRD 7.7 감정 캘린더: "심플한 아이콘형 표정" — 5단계로 단순화 (세분화할수록 AI 자동 태깅 정확도가 떨어짐).
// character는 온보딩용으로 준비됐던 포즈 중 표정이 그나마 가까운 걸로 매칭한 것 — 슬픔/분노 전용
// 포즈가 없어서 완벽하진 않음(별로=갸웃, 힘듦=자는 모습으로 대체).
export const EMOTIONS = [
  { key: "great", emoji: "😄", label: "최고", character: "/character/horse-excited.svg" },
  { key: "good", emoji: "🙂", label: "좋음", character: "/character/horse-greet.svg" },
  { key: "neutral", emoji: "😐", label: "그냥 그럼", character: "/character/horse-watch.svg" },
  { key: "bad", emoji: "😔", label: "별로", character: "/character/horse-tilt-head.svg" },
  { key: "rough", emoji: "😢", label: "힘듦", character: "/character/horse-sleeping.svg" },
] as const;

export type EmotionKey = (typeof EMOTIONS)[number]["key"];

const EMOJI_BY_KEY = new Map(EMOTIONS.map((e) => [e.key, e.emoji]));
const CHARACTER_BY_KEY = new Map(EMOTIONS.map((e) => [e.key, e.character]));

export function emojiFor(key: string): string {
  return EMOJI_BY_KEY.get(key as EmotionKey) ?? "❔";
}

export function characterFor(key: string): string | null {
  return CHARACTER_BY_KEY.get(key as EmotionKey) ?? null;
}

export function isEmotionKey(value: unknown): value is EmotionKey {
  return typeof value === "string" && EMOJI_BY_KEY.has(value as EmotionKey);
}
