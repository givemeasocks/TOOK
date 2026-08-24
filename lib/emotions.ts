// PRD 7.7 감정 캘린더: "심플한 아이콘형 표정" — 5단계로 단순화 (세분화할수록 AI 자동 태깅 정확도가 떨어짐).
export const EMOTIONS = [
  { key: "great", emoji: "😄", label: "최고" },
  { key: "good", emoji: "🙂", label: "좋음" },
  { key: "neutral", emoji: "😐", label: "그냥 그럼" },
  { key: "bad", emoji: "😔", label: "별로" },
  { key: "rough", emoji: "😢", label: "힘듦" },
] as const;

export type EmotionKey = (typeof EMOTIONS)[number]["key"];

const EMOJI_BY_KEY = new Map(EMOTIONS.map((e) => [e.key, e.emoji]));

export function emojiFor(key: string): string {
  return EMOJI_BY_KEY.get(key as EmotionKey) ?? "❔";
}

export function isEmotionKey(value: unknown): value is EmotionKey {
  return typeof value === "string" && EMOJI_BY_KEY.has(value as EmotionKey);
}
