import { GeminiProvider } from "./providers/gemini";
import type { AIProvider } from "./types";

// 제공자를 통째로 바꿀 땐 이 한 줄만 교체하면 된다.
export const ai: AIProvider = new GeminiProvider();

export { AI_CONFIG } from "./config";
export type { AIProvider } from "./types";
