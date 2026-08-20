const NOISE_EXACT = new Set([
  "사진",
  "동영상",
  "이모티콘",
  "음성메시지",
  "삭제된 메시지입니다.",
  "톡캘린더 일정이 생성되었습니다.",
]);

const NOISE_PREFIXES = ["파일: ", "사진 ", "동영상 "];

// 이모지/기호로만 이루어진 짧은 메시지 (자모/특수문자만, 한글 단어·문장 없음)
const ONLY_SYMBOLS = /^[\p{Emoji_Presentation}\p{Symbol}\sㄱ-ㆎ.!?~ㅋㅎㄷㅜㅠ]+$/u;

export function isNoiseMessage(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return true;
  if (trimmed.length < 30) return true; // PRD A.4: 30자 미만 제외
  if (NOISE_EXACT.has(trimmed)) return true;
  if (NOISE_PREFIXES.some((p) => trimmed.startsWith(p))) return true;
  if (ONLY_SYMBOLS.test(trimmed)) return true;
  return false;
}
