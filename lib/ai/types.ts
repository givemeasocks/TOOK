export interface AIProvider {
  summarize(text: string): Promise<string>;
  embed(text: string): Promise<number[]>;
  /** 카테고리 분류: 기존 카테고리 목록을 주면 맞는 것에 배정하거나, 없으면 새로 만든다 */
  classify(text: string, existingCategories: string[]): Promise<string>;
  /** 카톡 임포트용 일괄 분류. 반환 배열은 texts와 같은 길이·순서를 보장해야 한다 */
  classifyBatch(texts: string[], existingCategories: string[]): Promise<string[]>;
}
