/**
 * 모델 추상화 레이어의 설정 지점.
 * PRD 8.3: Gemini 모델은 몇 달 주기로 은퇴하므로, 모델명을 코드에 흩뿌리지 않고
 * 이 파일 + 환경변수로만 교체 가능하게 한다.
 */
export const AI_CONFIG = {
  summaryModel: process.env.AI_SUMMARY_MODEL || "gemini-flash-lite-latest",
  embeddingModel: process.env.AI_EMBEDDING_MODEL || "gemini-embedding-001",
  // supabase/schema.sql의 memos.embedding 컬럼 차원(vector(768))과 반드시 일치해야 함
  embeddingDimensions: 768,
} as const;
