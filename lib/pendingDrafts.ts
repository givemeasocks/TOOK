import "server-only";

type PendingDraft = {
  content: string;
  summary: string;
  embedding: number[];
  proposedCategory: string;
  source: "manual" | "kakao";
  createdAt: number;
};

const DRAFT_TTL_MS = 10 * 60 * 1000;

const store = new Map<string, PendingDraft>();

function sweep() {
  const now = Date.now();
  for (const [id, draft] of store) {
    if (now - draft.createdAt > DRAFT_TTL_MS) store.delete(id);
  }
}

export function savePendingDraft(draft: Omit<PendingDraft, "createdAt">): string {
  sweep();
  const id = crypto.randomUUID();
  store.set(id, { ...draft, createdAt: Date.now() });
  return id;
}

export function takePendingDraft(id: string): PendingDraft | null {
  const draft = store.get(id);
  if (!draft) return null;
  store.delete(id);
  return draft;
}
