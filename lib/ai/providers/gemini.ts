import { GoogleGenAI, Type } from "@google/genai";
import { AI_CONFIG } from "../config";
import type { AIProvider } from "../types";

let client: GoogleGenAI | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY 환경변수가 없습니다");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export class GeminiProvider implements AIProvider {
  async summarize(text: string): Promise<string> {
    const res = await getClient().models.generateContent({
      model: AI_CONFIG.summaryModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `다음 메모를 한 줄(최대 40자)로 요약해. 설명이나 따옴표 없이 요약문만 출력해.\n\n메모:\n${text}`,
            },
          ],
        },
      ],
    });
    return (res.text ?? "").trim();
  }

  async embed(text: string): Promise<number[]> {
    const res = await getClient().models.embedContent({
      model: AI_CONFIG.embeddingModel,
      contents: text,
      config: { outputDimensionality: AI_CONFIG.embeddingDimensions },
    });
    const values = res.embeddings?.[0]?.values;
    if (!values) throw new Error("임베딩 생성 실패: 빈 응답");
    return values;
  }

  async classify(text: string, existingCategories: string[]): Promise<string> {
    const categoryList = existingCategories.length
      ? existingCategories.join(", ")
      : "(아직 없음)";
    const res = await getClient().models.generateContent({
      model: AI_CONFIG.summaryModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `너는 개인 메모 아카이브의 분류기다. 아래 메모를 생활 영역 기준 카테고리 하나로 분류해.

규칙:
- 기존 카테고리 목록에 의미가 맞는 게 있으면 반드시 그걸 그대로 재사용해라
- 기존 카테고리 중 어느 것도 이 메모의 실제 내용과 맞지 않으면, 내용에 맞는 새 카테고리를 만들어라. 억지로 기존 카테고리에 끼워 맞추지 마라
- 카테고리명은 "술", "레시피", "일정", "상식", "쇼핑"처럼 생활 영역 기준의 짧은 명사 1~2단어로 — 이건 형식 예시일 뿐, 실제로 써야 할 단어 목록이 아니다. 메모 내용에 맞는 이름을 자유롭게 만들어라
- 과분할 금지: 이미 있는 카테고리와 의미가 겹치면 새로 만들지 말고 기존 걸 써라. 하지만 의미가 다르면 절대 기존 카테고리에 욱여넣지 마라

기존 카테고리 목록: ${categoryList}

메모:
${text}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { category: { type: Type.STRING } },
          required: ["category"],
        },
      },
    });
    const parsed = JSON.parse(res.text ?? "{}");
    return (parsed.category ?? "미분류").trim();
  }

  async classifyBatch(texts: string[], existingCategories: string[]): Promise<string[]> {
    if (texts.length === 0) return [];
    const categoryList = existingCategories.length
      ? existingCategories.join(", ")
      : "(아직 없음)";
    const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");

    const res = await getClient().models.generateContent({
      model: AI_CONFIG.summaryModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `너는 개인 메모 아카이브의 분류기다. 아래 메모 ${texts.length}개 각각을 생활 영역 기준 카테고리 하나로 분류해.

규칙:
- 기존 카테고리 목록에 의미가 맞는 게 있으면 반드시 그걸 그대로 재사용해라
- 기존 카테고리 중 어느 것도 그 메모의 실제 내용과 맞지 않으면, 내용에 맞는 새 카테고리를 만들어라. 억지로 기존 카테고리에 끼워 맞추지 마라
- 카테고리명은 "술", "레시피", "일정", "상식", "쇼핑"처럼 생활 영역 기준의 짧은 명사 1~2단어로 — 이건 형식 예시일 뿐, 실제로 써야 할 단어 목록이 아니다. 메모마다 내용에 맞는 이름을 자유롭게 만들어라
- 과분할 금지: 이미 있는 카테고리와 의미가 겹치면 새로 만들지 말고 기존 걸 써라. 하지만 의미가 다르면 절대 기존 카테고리에 욱여넣지 마라
- categories 배열은 반드시 입력 순서대로, 정확히 ${texts.length}개를 반환해라

기존 카테고리 목록: ${categoryList}

메모 목록:
${numbered}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categories: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["categories"],
        },
      },
    });

    const parsed = JSON.parse(res.text ?? "{}");
    const categories: string[] = Array.isArray(parsed.categories) ? parsed.categories : [];

    if (categories.length !== texts.length) {
      // 배치 응답 개수가 어긋나면 안전하게 하나씩 재시도
      return Promise.all(texts.map((t) => this.classify(t, existingCategories)));
    }
    return categories.map((c) => (c ?? "미분류").trim());
  }
}
