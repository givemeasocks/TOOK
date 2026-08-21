export type MemoRow = {
  id: string;
  content: string;
  summary: string | null;
  category: string | null;
  category_edited: boolean;
  source: "manual";
  created_at: string;
};
