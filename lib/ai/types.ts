import type { EmotionKey } from "../emotions";

export type EmbedTaskType = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";

export interface AIProvider {
  summarize(text: string): Promise<string>;
  /** taskType을 비대칭으로 지정해야 검색 정확도가 나옴: 저장할 땐 DOCUMENT, 검색어엔 QUERY */
  embed(text: string, taskType: EmbedTaskType): Promise<number[]>;
  /**
   * 카테고리 분류: 기존 카테고리 목록을 주면 맞는 것에 배정하거나, 없으면 새로 만든다.
   * 보통 1개, 애매하게 두 영역에 걸치는 경우에만 최대 2개까지 반환한다.
   */
  classify(text: string, existingCategories: string[]): Promise<string[]>;
  /**
   * 벡터 검색으로 추린 후보를 실제 검색어 관련성 기준 0~1 점수로 재채점한다.
   * 순수 코사인 유사도보다 정밀한 최종 판단용. candidates와 같은 길이·순서를 보장해야 한다.
   */
  rerank(query: string, candidates: string[]): Promise<number[]>;
  /**
   * PRD 7.5 "카테고리 상한": 의미가 겹치는 카테고리(예: "위스키"+"술")를 찾아 병합을 제안한다.
   * into는 반드시 입력 카테고리 중 하나. from은 into로 흡수될 다른 카테고리들.
   */
  suggestMerges(categories: { name: string; count: number }[]): Promise<{ into: string; from: string[] }[]>;
  /**
   * 스크린샷·사진에서 텍스트를 추출한다 (서버 사이드 OCR, PRD의 온디바이스 OCR을 웹 환경에 맞게 대체).
   * 텍스트가 없으면 빈 문자열을 반환한다.
   */
  ocr(imageBase64: string, mimeType: string): Promise<string>;
  /**
   * PRD 7.7 감정 캘린더: 하루치 메모(들)을 보고 일상/일기 성격인 것만 근거로 그날의 대표 감정을 고른다.
   * 일상/일기 메모가 하나도 없거나(전부 정보성) 감정이 뚜렷하지 않으면 null — 애매하면 태깅하지 않는다.
   */
  tagDailyEmotion(memoTexts: string[]): Promise<EmotionKey | null>;
}
