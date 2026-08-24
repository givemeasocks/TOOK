// PRD 7.7 감정 캘린더: "심플한 아이콘형 표정" — 5단계로 단순화 (세분화할수록 AI 자동 태깅 정확도가 떨어짐).
// character는 각 단계 전용으로 준비된 표정 그림.
export const EMOTIONS = [
  { key: "great", emoji: "😆", label: "더할나위없음", character: "/character/horse-great.svg" },
  { key: "good", emoji: "🙂", label: "좋았음", character: "/character/horse-good.svg" },
  { key: "neutral", emoji: "😐", label: "쏘쏘", character: "/character/horse-neutral.svg" },
  { key: "bad", emoji: "😕", label: "별로", character: "/character/horse-bad.svg" },
  { key: "rough", emoji: "😞", label: "졸라힘듦", character: "/character/horse-rough.svg" },
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
