import "server-only";

const SHARE_TTL_MS = 5 * 60 * 1000;

const store = new Map<string, { content: string; createdAt: number }>();

function sweep() {
  const now = Date.now();
  for (const [id, share] of store) {
    if (now - share.createdAt > SHARE_TTL_MS) store.delete(id);
  }
}

export function savePendingShare(content: string): string {
  sweep();
  const id = crypto.randomUUID();
  store.set(id, { content, createdAt: Date.now() });
  return id;
}

export function takePendingShare(id: string): string | null {
  const share = store.get(id);
  if (!share) return null;
  store.delete(id);
  return share.content;
}
