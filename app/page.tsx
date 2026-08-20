"use client";

import { useEffect, useRef, useState } from "react";

type Memo = {
  id: string;
  content: string;
  summary: string;
  category: string;
  category_edited?: boolean;
  similarity?: number;
};

type Drawer = {
  name: string;
  count: number;
};

const CATEGORY_TINTS = [
  "bg-card-tint-peach",
  "bg-card-tint-rose",
  "bg-card-tint-mint",
  "bg-card-tint-lavender",
  "bg-card-tint-sky",
  "bg-card-tint-yellow",
];

function tintFor(category: string) {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return CATEGORY_TINTS[hash % CATEGORY_TINTS.length];
}

function formatPct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function CategorySelect({
  memo,
  drawers,
  onChange,
  askText,
}: {
  memo: Memo;
  drawers: Drawer[];
  onChange: (category: string) => void;
  askText: (message: string, defaultValue?: string) => Promise<string | null>;
}) {
  const options = Array.from(new Set([memo.category, ...drawers.map((d) => d.name)]));
  return (
    <select
      value={memo.category}
      onChange={async (e) => {
        if (e.target.value === "__new__") {
          const name = await askText("새 카테고리 이름");
          if (name?.trim()) onChange(name.trim());
          return;
        }
        onChange(e.target.value);
      }}
      className={`mb-1 inline-block rounded-sm border-0 px-2 py-0.5 text-xs font-semibold text-charcoal ${tintFor(memo.category)}`}
    >
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value="__new__">+ 새 카테고리</option>
    </select>
  );
}

type Dialog = { kind: "prompt" | "confirm"; message: string; defaultValue?: string };

export default function Home() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dialogInput, setDialogInput] = useState("");
  const dialogResolveRef = useRef<((value: string | null) => void) | null>(null);

  function askText(message: string, defaultValue = ""): Promise<string | null> {
    setDialog({ kind: "prompt", message, defaultValue });
    setDialogInput(defaultValue);
    return new Promise((resolve) => {
      dialogResolveRef.current = resolve;
    });
  }

  function askConfirm(message: string): Promise<boolean> {
    setDialog({ kind: "confirm", message });
    return new Promise((resolve) => {
      dialogResolveRef.current = (value) => resolve(value !== null);
    });
  }

  function closeDialog(value: string | null) {
    dialogResolveRef.current?.(value);
    dialogResolveRef.current = null;
    setDialog(null);
  }

  const [inputText, setInputText] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [drawers, setDrawers] = useState<Drawer[]>([]);

  async function loadDrawers() {
    const res = await fetch("/api/drawers");
    if (!res.ok) return;
    const { drawers } = await res.json();
    setDrawers(drawers);
  }

  const [stats, setStats] = useState<{
    recall: number | null;
    falsePositiveRate: number | null;
    classificationAccuracy: number | null;
  }>({ recall: null, falsePositiveRate: null, classificationAccuracy: null });

  async function loadStats() {
    const res = await fetch("/api/eval");
    if (!res.ok) return;
    setStats(await res.json());
  }

  useEffect(() => {
    loadDrawers();
    loadStats();
  }, []);

  const KAKAO_BATCH_SIZE = 15;
  const [kakaoProgress, setKakaoProgress] = useState<{ current: number; total: number } | null>(null);
  const [kakaoStatus, setKakaoStatus] = useState<string | null>(null);

  async function handleKakaoFile(file: File) {
    const text = await file.text();
    setKakaoStatus("파싱 중...");
    setKakaoProgress(null);

    const parseRes = await fetch("/api/kakao/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!parseRes.ok) {
      const { error } = await parseRes.json();
      setKakaoStatus(`파싱 실패: ${error}`);
      return;
    }
    const { contents, totalParsed } = await parseRes.json();
    if (contents.length === 0) {
      setKakaoStatus(`총 ${totalParsed}줄 중 정리할 만한 메모가 없어요`);
      return;
    }

    setKakaoStatus(null);
    setKakaoProgress({ current: 0, total: contents.length });

    const categorySet = new Set(drawers.map((d) => d.name));
    let insertedTotal = 0;

    for (let i = 0; i < contents.length; i += KAKAO_BATCH_SIZE) {
      const chunk = contents.slice(i, i + KAKAO_BATCH_SIZE);
      const batchRes = await fetch("/api/kakao/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: chunk, existingCategories: Array.from(categorySet) }),
      });
      if (batchRes.ok) {
        const data = await batchRes.json();
        insertedTotal += data.inserted;
        (data.categories as string[]).forEach((c) => categorySet.add(c));
      }
      setKakaoProgress({ current: Math.min(i + KAKAO_BATCH_SIZE, contents.length), total: contents.length });
    }

    setKakaoProgress(null);
    await loadDrawers();
    setKakaoStatus(`${insertedTotal}개를 ${categorySet.size}개 서랍에 정리했어요`);
  }

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [thresholdA, setThresholdA] = useState(0.72);
  const [thresholdB, setThresholdB] = useState(0.55);
  const [certain, setCertain] = useState<Memo[]>([]);
  const [maybe, setMaybe] = useState<Memo[]>([]);
  const [searched, setSearched] = useState(false);

  const [pendingDraft, setPendingDraft] = useState<{
    draftId: string;
    candidateCategories: string[];
    summary: string;
    existingCategories: string[];
    suggestedMemos: Memo[];
  } | null>(null);
  const [selectedMoveIds, setSelectedMoveIds] = useState<Set<string>>(new Set());

  function toggleMoveId(id: string) {
    setSelectedMoveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!inputText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputText }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        setToast(`저장 실패: ${error}`);
        return;
      }
      const data = await res.json();
      if (data.pending) {
        setSelectedDrawer(null);
        setPendingDraft(data);
        setSelectedMoveIds(new Set());
        setInputText("");
        return;
      }
      setInputText("");
      setToast("툭!");
      await loadDrawers();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  async function confirmDraft(categories: string[]) {
    if (!pendingDraft) return;
    const res = await fetch("/api/memos/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: pendingDraft.draftId,
        categories,
        alsoMoveIds: Array.from(selectedMoveIds),
      }),
    });
    setPendingDraft(null);
    setSelectedMoveIds(new Set());
    if (!res.ok) {
      const { error } = await res.json();
      setToast(`저장 실패: ${error}`);
      return;
    }
    const { movedCount } = await res.json();
    setToast(movedCount > 0 ? `툭! (+${movedCount}개 같이 옮김)` : "툭!");
    setTimeout(() => setToast(null), 2000);
    await loadDrawers();
  }

  const [selectedDrawer, setSelectedDrawer] = useState<string | null>(null);
  const [drawerMemos, setDrawerMemos] = useState<Memo[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  async function handleDeleteMemo(memo: Memo) {
    if (!(await askConfirm("이 메모를 삭제할까요?"))) return;
    const res = await fetch(`/api/memos/${memo.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setCertain((list) => list.filter((m) => m.id !== memo.id));
    setMaybe((list) => list.filter((m) => m.id !== memo.id));
    setDrawerMemos((list) => list.filter((m) => m.id !== memo.id));
    await loadDrawers();
  }

  async function renameDrawer(name: string) {
    const newName = await askText("새 서랍 이름", name);
    if (!newName?.trim() || newName.trim() === name) return;
    const res = await fetch("/api/drawers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, newName: newName.trim() }),
    });
    if (!res.ok) return;
    setSelectedDrawer(newName.trim());
    await loadDrawers();
    await openDrawer(newName.trim());
  }

  async function deleteDrawer(name: string, count: number) {
    if (count > 0) {
      const target = await askText(
        `"${name}" 안에 메모가 ${count}개 있어요.\n옮길 서랍 이름을 입력하면 그쪽으로 옮겨요.\n빈 채로 확인하면 메모까지 전부 삭제돼요. (취소하면 아무 일도 안 일어남)`,
        ""
      );
      if (target === null) return;
      if (target.trim()) {
        const res = await fetch("/api/drawers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, newName: target.trim() }),
        });
        if (!res.ok) return;
        closeDrawer();
        await loadDrawers();
        return;
      }
      if (!(await askConfirm(`정말 메모 ${count}개를 전부 삭제할까요? 되돌릴 수 없어요.`))) return;
    }
    const res = await fetch(`/api/drawers?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (!res.ok) return;
    closeDrawer();
    await loadDrawers();
  }

  async function openDrawer(name: string) {
    setPendingDraft(null);
    setSelectedDrawer(name);
    setDrawerLoading(true);
    const res = await fetch(`/api/memos?category=${encodeURIComponent(name)}`);
    if (res.ok) {
      const { memos } = await res.json();
      setDrawerMemos(memos);
    }
    setDrawerLoading(false);
  }

  function closeDrawer() {
    setSelectedDrawer(null);
    setDrawerMemos([]);
  }

  async function handleCategoryChange(memo: Memo, newCategory: string) {
    const res = await fetch(`/api/memos/${memo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCategory }),
    });
    if (!res.ok) return;
    const update = (list: Memo[]) =>
      list.map((m) => (m.id === memo.id ? { ...m, category: newCategory, category_edited: true } : m));
    setCertain(update);
    setMaybe(update);
    // 서랍 상세에서 고친 경우, 카테고리가 바뀌었으면 이 서랍 목록에서는 사라짐
    setDrawerMemos((list) => list.filter((m) => m.id !== memo.id));
    await loadDrawers();
  }

  const [votes, setVotes] = useState<Record<string, boolean>>({});

  async function handleVote(memo: Memo, relevant: boolean) {
    const key = `${query}::${memo.id}`;
    setVotes((v) => ({ ...v, [key]: relevant }));
    await fetch("/api/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        memo_id: memo.id,
        relevant,
        similarity: memo.similarity ?? null,
      }),
    });
    await loadStats();
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: query,
        a: String(thresholdA),
        b: String(thresholdB),
      });
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) {
        const { error } = await res.json();
        setToast(`검색 실패: ${error}`);
        return;
      }
      const { certain, maybe } = await res.json();
      setCertain(certain);
      setMaybe(maybe);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      {toast && (
        <div className="fixed top-6 right-6 z-50 rounded-md bg-ink-deep px-4 py-2 text-sm text-on-dark shadow-[var(--shadow-4)]">
          {toast}
        </div>
      )}

      {dialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-deep/40 px-4"
          onClick={() => closeDialog(null)}
        >
          <div
            className="w-full max-w-[22rem] rounded-lg bg-canvas p-5 shadow-[var(--shadow-4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="whitespace-pre-line text-sm text-ink">{dialog.message}</p>
            {dialog.kind === "prompt" && (
              <input
                autoFocus
                value={dialogInput}
                onChange={(e) => setDialogInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") closeDialog(dialogInput);
                  if (e.key === "Escape") closeDialog(null);
                }}
                className="mt-3 h-10 w-full rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink outline-none focus:border-2 focus:border-primary"
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => closeDialog(null)} className="rounded-md px-3 py-1.5 text-sm text-steel">
                취소
              </button>
              <button
                onClick={() => closeDialog(dialog.kind === "prompt" ? dialogInput : "confirmed")}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/40 px-4"
          onClick={() => setPendingDraft(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-[24rem] flex-col rounded-lg bg-canvas p-6 shadow-[var(--shadow-4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-steel">
                {pendingDraft.candidateCategories.length > 1 ? "카테고리 선택" : "새 서랍"}
              </span>
              <button onClick={() => setPendingDraft(null)} className="text-sm text-steel" aria-label="닫기">
                닫기
              </button>
            </div>
            <div className="overflow-y-auto">
              <p className="text-sm text-steel">{pendingDraft.summary}</p>

              {pendingDraft.candidateCategories.length > 1 ? (
                <>
                  <p className="mt-3 text-sm text-ink">
                    {pendingDraft.candidateCategories.map((c, i) => (
                      <span key={c}>
                        {i > 0 && " / "}
                        <span className={`inline-block rounded-sm px-2 py-0.5 text-sm font-semibold text-charcoal ${tintFor(c)}`}>
                          {c}
                        </span>
                      </span>
                    ))}
                    {" "}둘 다에 해당할 수 있어요. 어디에 저장할까요?
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {pendingDraft.candidateCategories.map((c) => (
                      <button
                        key={c}
                        onClick={() => confirmDraft([c])}
                        className="h-11 w-full rounded-md border border-hairline-strong text-sm font-medium text-ink"
                      >
                        {c}에만 저장
                      </button>
                    ))}
                    <button
                      onClick={() => confirmDraft(pendingDraft.candidateCategories)}
                      className="h-11 w-full rounded-md bg-primary text-sm font-medium text-on-primary"
                    >
                      둘 다 저장
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-base text-ink">
                    <span className={`inline-block rounded-sm px-2 py-0.5 text-sm font-semibold text-charcoal ${tintFor(pendingDraft.candidateCategories[0])}`}>
                      {pendingDraft.candidateCategories[0]}
                    </span>
                    {" "}서랍을 새로 만들까요?
                  </p>

                  {pendingDraft.suggestedMemos.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-steel">비슷한 메모도 같이 옮길까요?</p>
                      <div className="flex flex-col gap-1.5">
                        {pendingDraft.suggestedMemos.map((m) => (
                          <label key={m.id} className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedMoveIds.has(m.id)}
                              onChange={() => toggleMoveId(m.id)}
                              className="mt-1 accent-primary"
                            />
                            <span className="text-ink">
                              {m.summary}
                              <span className="ml-1 text-xs text-muted">(현재: {m.category})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => confirmDraft([pendingDraft.candidateCategories[0]])}
                    className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-on-primary"
                  >
                    네, 새로 만들기
                  </button>
                  {pendingDraft.existingCategories.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs text-steel">아니면 기존 서랍에 넣기</p>
                      <div className="flex flex-wrap gap-2">
                        {pendingDraft.existingCategories.map((c) => (
                          <button
                            key={c}
                            onClick={() => confirmDraft([c])}
                            className={`rounded-sm px-2 py-1 text-xs font-semibold text-charcoal ${tintFor(c)}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/40 px-4"
          onClick={closeDrawer}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[32rem] flex-col rounded-lg bg-canvas p-6 shadow-[var(--shadow-4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-ink">{selectedDrawer}</h3>
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={() => renameDrawer(selectedDrawer)} className="text-xs text-steel underline">
                  이름 바꾸기
                </button>
                <button
                  onClick={() => deleteDrawer(selectedDrawer, drawerMemos.length)}
                  className="text-xs text-error underline"
                >
                  서랍 삭제
                </button>
                <button onClick={closeDrawer} className="text-sm text-steel">
                  닫기
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {drawerLoading ? (
                <p className="text-sm text-steel">불러오는 중...</p>
              ) : drawerMemos.length === 0 ? (
                <p className="text-sm text-steel">이 서랍이 비었어요.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {drawerMemos.map((m) => (
                    <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-hairline bg-canvas p-4">
                      <div>
                        <CategorySelect
                          memo={m}
                          drawers={drawers}
                          onChange={(c) => handleCategoryChange(m, c)}
                          askText={askText}
                        />
                        {m.category_edited && <span className="ml-1 text-xs text-muted">(수정됨)</span>}
                        <p className="text-sm text-ink">{m.summary}</p>
                      </div>
                      <button
                        aria-label="메모 삭제"
                        onClick={() => handleDeleteMemo(m)}
                        className="shrink-0 text-xs text-muted hover:text-error"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">TOOK — v0 프로토타입</h1>
        <p className="text-sm text-steel">
          목적은 예쁜 앱이 아니라 검색 품질 측정. 넣기 → 서랍 → 꺼내기.
        </p>
      </header>

      {/* [1] 넣기 */}
      <section className="rounded-lg border border-hairline bg-canvas p-6 shadow-[var(--shadow-1)]">
        <h2 className="mb-4 text-lg font-semibold text-ink">1. 넣기</h2>
        <div className="flex gap-2">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="텍스트 입력..."
            className="h-11 flex-1 rounded-md border border-hairline-strong bg-canvas px-4 text-base text-ink outline-none focus:border-2 focus:border-primary"
          />
          <button
            onClick={handleSave}
            disabled={saving || !inputText.trim()}
            className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="cursor-pointer rounded-md border border-hairline-strong bg-canvas px-4 py-2 text-sm text-ink">
            카톡 .txt 업로드
            <input
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleKakaoFile(file);
                e.target.value = "";
              }}
            />
          </label>
          {kakaoProgress ? (
            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round((kakaoProgress.current / kakaoProgress.total) * 100)}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs text-steel tabular-nums">
                {Math.round((kakaoProgress.current / kakaoProgress.total) * 100)}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-steel">{kakaoStatus ?? "아직 업로드된 파일 없음"}</span>
          )}
        </div>
      </section>

      {/* [2] 서랍 */}
      <section className="rounded-lg border border-hairline bg-canvas p-6 shadow-[var(--shadow-1)]">
        <h2 className="mb-4 text-lg font-semibold text-ink">2. 서랍</h2>
        {drawers.length === 0 ? (
          <p className="text-sm text-steel">아직 만들어진 서랍이 없어요. 메모를 저장하면 자동으로 생겨요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {drawers.map((d) => (
              <button
                key={d.name}
                onClick={() => openDrawer(d.name)}
                className={`rounded-lg p-4 text-left text-charcoal transition-transform hover:-translate-y-0.5 ${tintFor(d.name)}`}
              >
                <div className="text-sm font-medium">{d.name}</div>
                <div className="text-xs text-charcoal/70">{d.count}개</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* [3] 꺼내기 */}
      <section className="rounded-lg border border-hairline bg-canvas p-6 shadow-[var(--shadow-1)]">
        <h2 className="mb-4 text-lg font-semibold text-ink">3. 꺼내기</h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="술"
            className="h-11 flex-1 rounded-md bg-surface px-4 text-base text-steel outline-none focus:border-2 focus:border-primary"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
          >
            {searching ? "검색 중..." : "검색"}
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-sm text-slate">
            <span className="w-6">A</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={thresholdA}
              onChange={(e) => setThresholdA(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-10 tabular-nums">{thresholdA.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate">
            <span className="w-6">B</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={thresholdB}
              onChange={(e) => setThresholdB(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-10 tabular-nums">{thresholdB.toFixed(2)}</span>
          </div>
        </div>

        {searched && (
          <div className="mt-6 flex flex-col gap-6">
            <ResultGroup
              title={`확실한 결과 (${certain.length})`}
              memos={certain}
              drawers={drawers}
              onCategoryChange={handleCategoryChange}
              onDelete={handleDeleteMemo}
              askText={askText}
              query={query}
              votes={votes}
              onVote={handleVote}
            />
            <ResultGroup
              title={`혹시 이것도? (${maybe.length})`}
              memos={maybe}
              drawers={drawers}
              onCategoryChange={handleCategoryChange}
              onDelete={handleDeleteMemo}
              askText={askText}
              query={query}
              votes={votes}
              onVote={handleVote}
              muted
            />
            {certain.length === 0 && maybe.length === 0 && (
              <p className="text-sm text-steel">이건 아직 안 적어두셨네요</p>
            )}
          </div>
        )}
      </section>

      {/* 측정 결과 */}
      <section className="rounded-lg bg-surface p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate">📊 측정 결과</h2>
        <div className="flex flex-wrap gap-6 text-sm text-ink">
          <Stat label="재현율" value={formatPct(stats.recall)} />
          <Stat label="오탐률" value={formatPct(stats.falsePositiveRate)} />
          <Stat label="분류 정확도" value={formatPct(stats.classificationAccuracy)} />
        </div>
        <p className="mt-2 text-xs text-steel">
          검색 결과에 👍/👎를 눌러야 재현율·오탐률이 집계돼요.
        </p>
      </section>
    </main>
  );
}

function ResultGroup({
  title,
  memos,
  drawers,
  onCategoryChange,
  onDelete,
  askText,
  query,
  votes,
  onVote,
  muted,
}: {
  title: string;
  memos: Memo[];
  drawers: Drawer[];
  onCategoryChange: (memo: Memo, newCategory: string) => void;
  onDelete: (memo: Memo) => void;
  askText: (message: string, defaultValue?: string) => Promise<string | null>;
  query: string;
  votes: Record<string, boolean>;
  onVote: (memo: Memo, relevant: boolean) => void;
  muted?: boolean;
}) {
  if (memos.length === 0) return null;
  return (
    <div>
      <h3 className={`mb-2 text-sm font-medium ${muted ? "text-steel" : "text-ink"}`}>{title}</h3>
      <div className="flex flex-col gap-2">
        {memos.map((m) => {
          const voted = votes[`${query}::${m.id}`];
          return (
            <div
              key={m.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-hairline bg-canvas p-4"
            >
              <div>
                <CategorySelect memo={m} drawers={drawers} onChange={(c) => onCategoryChange(m, c)} askText={askText} />
                {m.category_edited && <span className="ml-1 text-xs text-muted">(수정됨)</span>}
                <p className="text-sm text-ink">{m.summary}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted">{m.similarity?.toFixed(2)}</span>
                <button
                  aria-label="관련 있음"
                  onClick={() => onVote(m, true)}
                  className={`rounded-sm px-1 text-base ${voted === true ? "opacity-100" : "opacity-40 hover:opacity-100"}`}
                >
                  👍
                </button>
                <button
                  aria-label="관련 없음"
                  onClick={() => onVote(m, false)}
                  className={`rounded-sm px-1 text-base ${voted === false ? "opacity-100" : "opacity-40 hover:opacity-100"}`}
                >
                  👎
                </button>
                <button
                  aria-label="메모 삭제"
                  onClick={() => onDelete(m)}
                  className="text-xs text-muted hover:text-error"
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-steel">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
