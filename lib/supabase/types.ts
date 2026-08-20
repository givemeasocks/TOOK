export type MemoRow = {
  id: string;
  content: string;
  summary: string | null;
  category: string | null;
  category_edited: boolean;
  source: "manual" | "kakao";
  created_at: string;
};
