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
  /** 카톡 임포트용 일괄 분류. 반환 배열은 texts와 같은 길이·순서를 보장해야 한다 */
  classifyBatch(texts: string[], existingCategories: string[]): Promise<string[]>;
}
