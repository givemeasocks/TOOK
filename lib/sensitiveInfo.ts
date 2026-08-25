// PRD 7.2: 로컬 패턴 검사로 비밀번호/카드/계좌/주민번호로 보이는 문자열을 감지 → 저장 전 팝업 확인.
// AI 호출 없이 순수 정규식이라 서버 왕복이나 외부 전송 없이 클라이언트에서 바로 검사할 수 있다.
const PATTERNS = [
  /(비밀번호|비번|패스워드|pw|password)\s*[:=은는이가]?\s*\S{3,}/i, // "비밀번호: abc123" 류
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // 카드번호(16자리)
  /\b\d{6}[- ]?[1-4]\d{6}\b/, // 주민등록번호(생년월일6 + 성별1 + 6자리)
  /계좌\s*(번호)?\s*[:：]?\s*\d[\d- ]{8,}/, // "계좌번호 110-123-456789" 류
];

export function detectSensitiveInfo(content: string): boolean {
  return PATTERNS.some((p) => p.test(content));
}
