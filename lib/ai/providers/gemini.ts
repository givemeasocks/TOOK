import { GoogleGenAI, Type } from "@google/genai";
import { AI_CONFIG } from "../config";
import type { AIProvider, EmbedTaskType } from "../types";

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

  async embed(text: string, taskType: EmbedTaskType): Promise<number[]> {
    const res = await getClient().models.embedContent({
      model: AI_CONFIG.embeddingModel,
      contents: text,
      config: { outputDimensionality: AI_CONFIG.embeddingDimensions, taskType },
    });
    const values = res.embeddings?.[0]?.values;
    if (!values) throw new Error("임베딩 생성 실패: 빈 응답");
    return values;
  }

  async classify(text: string, existingCategories: string[]): Promise<string[]> {
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
              text: `너는 개인 메모 아카이브의 분류기다. 아래 메모를 생활 영역 기준 카테고리로 분류해.

규칙:
- 보통은 카테고리를 1개만 골라라
- 딱 하나로 정하기 애매하고 서로 다른 두 영역에 동시에 걸쳐 있을 때만 최대 2개까지 제안해라 (예: "누가 그립다"는 메모는 "감정"이면서 동시에 "일기"이기도 함). 애매하지 않은 메모에 억지로 2개를 붙이지 마라
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
          properties: { categories: { type: Type.ARRAY, items: { type: Type.STRING } } },
          required: ["categories"],
        },
      },
    });
    const parsed = JSON.parse(res.text ?? "{}");
    const raw: unknown[] = Array.isArray(parsed.categories) ? parsed.categories : [];
    const cleaned = Array.from(
      new Set(raw.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean))
    ).slice(0, 2);
    return cleaned.length > 0 ? cleaned : ["미분류"];
  }

  async rerank(query: string, candidates: string[]): Promise<number[]> {
    if (candidates.length === 0) return [];
    const numbered = candidates.map((c, i) => `${i + 1}. ${c}`).join("\n");

    const res = await getClient().models.generateContent({
      model: AI_CONFIG.summaryModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `너는 개인 메모 검색의 재랭킹 판정기다. 사용자가 "${query}"로 검색했다.

아래 메모 후보 ${candidates.length}개 각각이 이 검색어와 실제로 관련 있는지 0~1 사이 점수로 판단해라.
- 1에 가까울수록 확실히 관련 있음, 0에 가까울수록 무관함
- 검색어와 글자가 안 겹쳐도 의미적으로 관련 있으면 높은 점수를 줘라 (예: "술" 검색에 "위스키", "와인" 메모는 관련 있음)
- 검색어와 무관한 내용인데 우연히 비슷한 분위기라서 걸린 것뿐이면 낮은 점수를 줘라
- scores 배열은 반드시 입력 순서대로, 정확히 ${candidates.length}개를 반환해라

메모 후보:
${numbered}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { scores: { type: Type.ARRAY, items: { type: Type.NUMBER } } },
          required: ["scores"],
        },
      },
    });

    const parsed = JSON.parse(res.text ?? "{}");
    const scores: unknown[] = Array.isArray(parsed.scores) ? parsed.scores : [];
    if (scores.length !== candidates.length) {
      throw new Error(`재랭킹 응답 개수가 안 맞음: ${scores.length} !== ${candidates.length}`);
    }
    return scores.map((s) => Math.max(0, Math.min(1, typeof s === "number" ? s : 0)));
  }

  async suggestMerges(
    categories: { name: string; count: number }[]
  ): Promise<{ into: string; from: string[] }[]> {
    if (categories.length < 2) return [];
    const listed = categories.map((c) => `- ${c.name} (${c.count}개)`).join("\n");

    const res = await getClient().models.generateContent({
      model: AI_CONFIG.summaryModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `너는 개인 메모 아카이브의 카테고리(서랍) 목록을 정리하는 담당자다. 아래는 현재 서랍 목록과 각 서랍에 든 메모 개수다.

과분할된 서랍(같은 내용을 가리키는데 이름만 다르게 쪼개진 것)을 찾아 병합을 제안해라.

규칙:
- 예: "위스키"와 "술"은 같은 생활 영역을 가리키므로 병합 대상. 하지만 "레시피"와 "쇼핑"처럼 서로 다른 생활 영역이면 절대 합치지 마라
- 이름만 다르고 실질적으로 같은 뜻(동의어, 오타, 존재하나 마나 한 세분화)일 때만 묶어라. 사용자가 의도적으로 세분화했을 수 있는 경우(예: "위스키"가 이미 12개나 쌓여 독립된 관심사로 보이면)는 무리하게 합치지 마라
- 묶을 땐 그 그룹에서 메모 개수가 가장 많거나 더 일반적인 이름을 into로 선택해라
- 애매하면 병합하지 마라. 병합 대상이 없으면 빈 배열을 반환해라
- 한 서랍은 최대 한 그룹에만 속해야 한다

서랍 목록:
${listed}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  into: { type: Type.STRING },
                  from: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["into", "from"],
              },
            },
          },
          required: ["merges"],
        },
      },
    });

    const parsed = JSON.parse(res.text ?? "{}");
    const raw: unknown[] = Array.isArray(parsed.merges) ? parsed.merges : [];
    const validNames = new Set(categories.map((c) => c.name));
    const used = new Set<string>();
    const merges: { into: string; from: string[] }[] = [];

    for (const m of raw) {
      if (typeof m !== "object" || m === null) continue;
      const { into, from } = m as { into?: unknown; from?: unknown };
      if (typeof into !== "string" || !validNames.has(into) || used.has(into)) continue;
      const cleanedFrom = Array.from(new Set(Array.isArray(from) ? from : []))
        .filter((f): f is string => typeof f === "string" && validNames.has(f) && f !== into && !used.has(f));
      if (cleanedFrom.length === 0) continue;
      used.add(into);
      cleanedFrom.forEach((f) => used.add(f));
      merges.push({ into, from: cleanedFrom });
    }
    return merges;
  }

  async ocr(imageBase64: string, mimeType: string): Promise<string> {
    const res = await getClient().models.generateContent({
      model: AI_CONFIG.summaryModel,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: imageBase64, mimeType } },
            {
              text: `이 이미지(스크린샷 또는 사진)에서 읽을 수 있는 텍스트를 전부 추출해줘.
- 설명·요약 없이 원문 텍스트만 그대로 출력해
- UI 버튼 라벨, 상태바, 앱 로고처럼 메모 내용과 무관한 화면 요소는 빼고 실제 내용에 해당하는 텍스트만
- 읽을 수 있는 텍스트가 전혀 없으면 아무것도 출력하지 마`,
            },
          ],
        },
      ],
    });
    return (res.text ?? "").trim();
  }
}
