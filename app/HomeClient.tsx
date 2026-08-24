"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InstallPrompt from "./InstallPrompt";
import ReminderOptIn from "./ReminderOptIn";
import EmotionCalendar from "./EmotionCalendar";
import { getSupabaseBrowser } from "@/lib/supabase/browserClient";

type Memo = {
  id: string;
  content: string;
  summary: string;
  category: string;
  category_edited?: boolean;
  similarity?: number;
};

type Drawer = {
  id: string;
  name: string;
  count: number;
  memberCount: number;
};

type DrawerMember = {
  id: string;
  invited_email: string;
  status: "pending" | "accepted";
  user_id: string | null;
};

// DESIGN_took.md 3.2: 자주 쓰는 카테고리는 고정 색, 그 외는 이름을 해시해 파스텔 팔레트에서 자동 배정 (동일 이름 = 항상 동일 색)
const FIXED_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "술": { bg: "#E3C9A4", text: "#5c4a30" },
  "레시피": { bg: "#C9CDB0", text: "#4a4d38" },
  "음식": { bg: "#C9CDB0", text: "#4a4d38" },
  "살림": { bg: "#D9BFAF", text: "#5c4030" },
  "아이디어": { bg: "#C9B8CF", text: "#4c3d51" },
  "쇼핑": { bg: "#B8C4CF", text: "#33404d" },
  "일상": { bg: "#CFC5B8", text: "#4a4234" },
  "미분류": { bg: "#D8D0C4", text: "#4a4234" },
};

const HASH_CATEGORY_PALETTE = [
  { bg: "#D6D9C0", text: "#4a4d38" },
  { bg: "#E0C7B0", text: "#5c4a30" },
  { bg: "#C7D0D6", text: "#33404d" },
  { bg: "#DCC3B8", text: "#5c4030" },
  { bg: "#D3C6A6", text: "#4a4234" },
];

function colorFor(category: string): { bg: string; text: string } {
  if (FIXED_CATEGORY_COLORS[category]) return FIXED_CATEGORY_COLORS[category];
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return HASH_CATEGORY_PALETTE[hash % HASH_CATEGORY_PALETTE.length];
}

// DESIGN_took.md 5.2: 검색 결과 없음 / 첫 사용 / 서랍 비어있음 — 자는 말 일러스트 + 다정한 문구
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/character/horse-sleeping.svg" alt="" className="h-16 w-16 opacity-90" />
      <p className="text-sm text-steel">{text}</p>
    </div>
  );
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
      className="mb-1 inline-block rounded-full border-0 px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: colorFor(memo.category).bg, color: colorFor(memo.category).text }}
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

type Dialog =
  | { kind: "prompt"; message: string; defaultValue?: string }
  | { kind: "confirm"; message: string }
  | { kind: "choice"; message: string; choices: { label: string; value: string }[] };

const TABS = [
  { key: "input", label: "넣기", icon: "🐴" },
  { key: "drawers", label: "서랍", icon: "🧺" },
  { key: "search", label: "꺼내기", icon: "🔍" },
  { key: "calendar", label: "캘린더", icon: "📅" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function HomeClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("input");
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

  function askChoice(message: string, choices: { label: string; value: string }[]): Promise<string | null> {
    setDialog({ kind: "choice", message, choices });
    return new Promise((resolve) => {
      dialogResolveRef.current = resolve;
    });
  }

  function closeDialog(value: string | null) {
    dialogResolveRef.current?.(value);
    dialogResolveRef.current = null;
    setDialog(null);
  }

  const [inputText, setInputText] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; variant: "success" | "error" } | null>(null);
  const [drawers, setDrawers] = useState<Drawer[]>([]);

  function showToast(text: string, variant: "success" | "error" = "success") {
    setToast({ text, variant });
    setTimeout(() => setToast(null), 2000);
  }

  // 저장 순간 모션 (DESIGN_took.md 2.3/5.1): 다가감 → 무는 중 → 다 먹음, 3프레임을 1초 내외로 전환
  const BITE_FRAMES = ["/character/horse-bite-before.svg", "/character/horse-save-bite.svg", "/character/horse-bite-after.svg"];
  const [biteFrame, setBiteFrame] = useState(0);
  const [biting, setBiting] = useState(false);

  function playBiteAnimation() {
    setBiting(true);
    setBiteFrame(0);
    setTimeout(() => setBiteFrame(1), 300);
    setTimeout(() => setBiteFrame(2), 650);
    setTimeout(() => setBiting(false), 1000);
  }

  // AI가 분류하는 동안(저장 버튼 누른 직후) 입력창 바로 아래서 계속 우물우물 씹는 걸 크게 보여준다 —
  // 토스트 구석의 작은 아이콘 하나로는 "먹는다"는 느낌이 잘 안 살아서, 저장 버튼을 누른 그 순간부터
  // 눈에 띄게 반복 재생한다 (DESIGN_took.md 2.3: "AI 종합 답변 로딩 — 우물우물 씹는 반복 모션").
  const [chewFrame, setChewFrame] = useState(0);
  useEffect(() => {
    if (!saving) {
      setChewFrame(0);
      return;
    }
    const id = setInterval(() => setChewFrame((f) => (f + 1) % 2), 350);
    return () => clearInterval(id);
  }, [saving]);

  // 요약을 탭하면 원문을 펼쳐서 보여준다 (PRD D-2: "요약이 먼저 보이고 탭하면 원문")
  // 펼쳐서 읽는 순간이 PRD 7.6 리마인드가 말하는 "열람"이라, 여기서 서버에도 알려준다.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        fetch(`/api/memos/${id}/view`, { method: "POST" }).catch(() => {});
      }
      return next;
    });
  }

  async function loadDrawers() {
    const res = await fetch("/api/drawers");
    if (!res.ok) return [] as Drawer[];
    const { drawers } = await res.json();
    setDrawers(drawers);
    return drawers as Drawer[];
  }

  const [mergeSuggestions, setMergeSuggestions] = useState<{ into: string; from: string[] }[] | null>(null);
  const [mergeChecking, setMergeChecking] = useState(false);
  const [mergingKey, setMergingKey] = useState<string | null>(null);

  async function checkMergeSuggestions() {
    setMergeChecking(true);
    try {
      const res = await fetch("/api/drawers/merge-suggestions");
      if (!res.ok) return;
      const { suggestions } = await res.json();
      setMergeSuggestions(suggestions);
    } finally {
      setMergeChecking(false);
    }
  }

  function dismissMerge(into: string) {
    setMergeSuggestions((list) => (list ?? []).filter((s) => s.into !== into));
  }

  async function applyMerge(suggestion: { into: string; from: string[] }) {
    setMergingKey(suggestion.into);
    try {
      for (const name of suggestion.from) {
        await fetch("/api/drawers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, newName: suggestion.into }),
        });
      }
      dismissMerge(suggestion.into);
      await loadDrawers();
    } finally {
      setMergingKey(null);
    }
  }

  useEffect(() => {
    loadDrawers();
  }, []);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [certain, setCertain] = useState<Memo[]>([]);
  const [maybe, setMaybe] = useState<Memo[]>([]);
  const [searched, setSearched] = useState(false);

  const [pendingDraft, setPendingDraft] = useState<{
    draftId: string;
    candidateCategories: string[];
    summary: string;
    existingCategories: string[];
    suggestedMemos: Memo[];
    schedule: { date: string; label: string } | null;
  } | null>(null);
  const [selectedMoveIds, setSelectedMoveIds] = useState<Set<string>>(new Set());
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [remindDayBefore, setRemindDayBefore] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // 버튼 두 번 눌림(모바일 더블탭 등) 때 React state로만 막으면, 두 클릭이 리렌더 전에 같은
  // 클로저(confirming=false)를 보고 둘 다 통과해버린다 — ref는 즉시 갱신되니 이걸로 막는다.
  const confirmingRef = useRef(false);

  function toggleMoveId(id: string) {
    setSelectedMoveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 저장할 때 AI가 고른 카테고리 말고, 다른 기존 서랍에도 추가로 중복 저장하고 싶을 때 체크
  const [extraCategories, setExtraCategories] = useState<Set<string>>(new Set());

  function toggleExtraCategory(name: string) {
    setExtraCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function withExtras(categories: string[]) {
    return Array.from(new Set([...categories, ...extraCategories]));
  }

  async function saveContent(content: string) {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        showToast(`이번엔 못 먹었어요. 다시 한 번 시도해볼까요? (${error})`, "error");
        return;
      }
      // AI 분류는 항상 확인을 거치므로 (/api/memos POST가 pending만 반환), 여기서 바로 완료되는 경로는 없음
      const data = await res.json();
      setSelectedDrawer(null);
      setPendingDraft(data);
      setSelectedMoveIds(new Set());
      setExtraCategories(new Set());
      setAddToCalendar(false);
      setRemindDayBefore(false);
      setInputText("");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await saveContent(inputText);
  }

  const [ocrLoading, setOcrLoading] = useState(false);

  // 스크린샷·사진에서 텍스트를 뽑아 입력창에 채운다 (PRD 이미지 OCR을 서버 사이드로 대체).
  // 오타·오독 가능성이 있어 바로 저장하지 않고 입력창에 채워서 확인·수정할 수 있게 한다.
  async function handleImageFile(file: File) {
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      if (!res.ok) {
        const { error } = await res.json();
        showToast(`이번엔 못 먹었어요. 다시 한 번 시도해볼까요? (${error})`, "error");
        return;
      }
      const { text } = await res.json();
      if (!text) {
        showToast("텍스트를 못 읽었어요. 직접 입력해주세요", "error");
        return;
      }
      // 입력창이 한 줄짜리라 줄바꿈이 그냥 사라져 보이므로, 여기 채울 때만 공백으로 합친다
      const cleaned = text.replace(/\s+/g, " ").trim();
      setInputText((prev) => (prev.trim() ? `${prev} ${cleaned}` : cleaned));
    } finally {
      setOcrLoading(false);
    }
  }

  // 다른 앱에서 "TOOK"으로 공유하면 /?shared=ID로 열린다 (app/api/share-target). 열리자마자 바로 저장 확인까지 간다.
  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("shared");
    if (!sharedId) return;
    window.history.replaceState({}, "", "/");
    (async () => {
      const res = await fetch(`/api/share-target/${sharedId}`);
      if (!res.ok) return;
      const { content } = await res.json();
      await saveContent(content);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmDraft(categories: string[]) {
    // 버튼 두 번 눌림(모바일 더블탭 등)으로 같은 draftId를 두 번 확정 요청하면, 먼저 온 요청이
    // draft를 이미 소모해버려서 두 번째는 "만료된 초안" 에러가 뜬다 — 저장은 잘 됐는데 에러 토스트가
    // 잠깐 스치듯 보이는 원인이었음. 확정 중엔 재진입을 막아서 방지한다.
    if (!pendingDraft || confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      const res = await fetch("/api/memos/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: pendingDraft.draftId,
          categories,
          alsoMoveIds: Array.from(selectedMoveIds),
          eventDate: addToCalendar ? pendingDraft.schedule?.date : undefined,
          remindDayBefore,
        }),
      });
      setPendingDraft(null);
      setSelectedMoveIds(new Set());
      setExtraCategories(new Set());
      setAddToCalendar(false);
      setRemindDayBefore(false);
      if (!res.ok) {
        const error = await res.json().then((d) => d.error).catch(() => `서버 오류 (${res.status})`);
        showToast(`이번엔 못 먹었어요. 다시 한 번 시도해볼까요? (${error})`, "error");
        return;
      }
      const { movedCount } = await res.json();
      playBiteAnimation();
      showToast(movedCount > 0 ? `툭! (+${movedCount}개 같이 옮김)` : "툭!", "success");
      await loadDrawers();
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  }

  const [selectedDrawer, setSelectedDrawer] = useState<Drawer | null>(null);
  const [drawerMemos, setDrawerMemos] = useState<Memo[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerMembers, setDrawerMembers] = useState<DrawerMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  async function loadMembers(drawerId: string) {
    const res = await fetch(`/api/drawers/${drawerId}/members`);
    if (!res.ok) return;
    const { members } = await res.json();
    setDrawerMembers(members);
  }

  async function handleInvite() {
    if (!selectedDrawer || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/drawers/${selectedDrawer.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        showToast(`초대하지 못했어요 (${error})`, "error");
        return;
      }
      setInviteEmail("");
      await loadMembers(selectedDrawer.id);
      await loadDrawers();
      showToast("초대했어요!", "success");
    } finally {
      setInviting(false);
    }
  }

  async function handleDeleteMemo(memo: Memo) {
    if (!(await askConfirm("이 메모를 삭제할까요?"))) return;
    const res = await fetch(`/api/memos/${memo.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setCertain((list) => list.filter((m) => m.id !== memo.id));
    setMaybe((list) => list.filter((m) => m.id !== memo.id));
    setDrawerMemos((list) => list.filter((m) => m.id !== memo.id));
    await loadDrawers();
  }

  async function renameDrawer(drawer: Drawer) {
    const newName = await askText("새 서랍 이름", drawer.name);
    if (!newName?.trim() || newName.trim() === drawer.name) return;
    const res = await fetch("/api/drawers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: drawer.name, newName: newName.trim() }),
    });
    if (!res.ok) return;
    const list = await loadDrawers();
    const updated = list.find((d) => d.name === newName.trim()) ?? { ...drawer, name: newName.trim() };
    await openDrawer(updated);
  }

  async function deleteDrawer(drawer: Drawer, count: number) {
    if (count > 0) {
      const target = await askText(
        `"${drawer.name}" 안에 메모가 ${count}개 있어요.\n옮길 서랍 이름을 입력하면 그쪽으로 옮겨요.\n빈 채로 확인하면 메모까지 전부 삭제돼요. (취소하면 아무 일도 안 일어남)`,
        ""
      );
      if (target === null) return;
      if (target.trim()) {
        const res = await fetch("/api/drawers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: drawer.name, newName: target.trim() }),
        });
        if (!res.ok) return;
        closeDrawer();
        await loadDrawers();
        return;
      }
      if (!(await askConfirm(`정말 메모 ${count}개를 전부 삭제할까요? 되돌릴 수 없어요.`))) return;
    }
    const res = await fetch(`/api/drawers?name=${encodeURIComponent(drawer.name)}`, { method: "DELETE" });
    if (!res.ok) return;
    closeDrawer();
    await loadDrawers();
  }

  async function openDrawer(drawer: Drawer) {
    setPendingDraft(null);
    setSelectedDrawer(drawer);
    setDrawerLoading(true);
    const res = await fetch(`/api/memos?category=${encodeURIComponent(drawer.name)}`);
    if (res.ok) {
      const { memos } = await res.json();
      setDrawerMemos(memos);
    }
    setDrawerLoading(false);
    await loadMembers(drawer.id);
  }

  function closeDrawer() {
    setSelectedDrawer(null);
    setDrawerMemos([]);
    setDrawerMembers([]);
    setInviteEmail("");
  }

  async function handleCategoryChange(memo: Memo, newCategory: string) {
    if (newCategory === memo.category) return;

    const mode = await askChoice(
      `'${memo.category}'에서 '${newCategory}'(으)로 옮길까요?`,
      [
        { label: "이동 — 원래 서랍에서는 없어짐", value: "move" },
        { label: "복사 — 원래 서랍에도 남고 새 서랍에도 생김", value: "copy" },
      ]
    );
    if (!mode) return;

    const res = await fetch(`/api/memos/${memo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCategory, mode }),
    });
    if (!res.ok) return;

    if (mode === "move") {
      const update = (list: Memo[]) =>
        list.map((m) => (m.id === memo.id ? { ...m, category: newCategory, category_edited: true } : m));
      setCertain(update);
      setMaybe(update);
      // 서랍 상세에서 고친 경우, 카테고리가 바뀌었으면 이 서랍 목록에서는 사라짐
      setDrawerMemos((list) => list.filter((m) => m.id !== memo.id));
    }
    // copy는 원본 카드를 그대로 두고, 새 서랍에 사본이 하나 더 생긴 것 — 서랍 개수만 갱신하면 됨
    await loadDrawers();
  }

  // 검색해서 확실한 결과를 찾은 순간도 "메인 모션"급으로 잠깐 화면 전체에 크게 보여준다.
  const [foundSplash, setFoundSplash] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: query });
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) {
        const { error } = await res.json();
        showToast(`검색 실패: ${error}`, "error");
        return;
      }
      const { certain, maybe } = await res.json();
      setCertain(certain);
      setMaybe(maybe);
      setSearched(true);
      if (certain.length > 0) {
        setFoundSplash(true);
        setTimeout(() => setFoundSplash(false), 1200);
      }
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 pt-10 pb-24">
      {/* 저장 완료 순간(DESIGN_took.md 2.3/5.1 "메인 모션")을 구석 토스트의 작은 아이콘 대신
          화면 전체에 크게 보여준다 — 안 그러면 눈에 잘 안 띄어서 놓치기 쉬움. */}
      {biting && toast && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas/95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BITE_FRAMES[biteFrame]} alt="" className="h-64 w-64 max-w-[70vw]" />
          <p className="text-lg font-semibold text-ink">{toast.text}</p>
        </div>
      )}

      {/* 에러도 구석의 작은 아이콘 하나로는 잘 안 보여서, 저장 모션과 똑같이 화면 전체로 보여준다. */}
      {toast && toast.variant === "error" && !biting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas/95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/character/horse-tilt-head.svg" alt="" className="h-64 w-64 max-w-[70vw]" />
          <p className="text-lg font-semibold text-ink">{toast.text}</p>
        </div>
      )}

      {toast && toast.variant === "success" && !biting && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-md bg-ink-deep px-4 py-2 text-sm text-on-dark shadow-[var(--shadow-4)]">
          {toast.text}
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
            {dialog.kind === "choice" ? (
              <div className="mt-4 flex flex-col gap-2">
                {dialog.choices.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => closeDialog(c.value)}
                    className="h-11 w-full rounded-md border border-hairline-strong text-sm font-medium text-ink"
                  >
                    {c.label}
                  </button>
                ))}
                <button onClick={() => closeDialog(null)} className="mt-1 text-sm text-steel">
                  취소
                </button>
              </div>
            ) : (
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
            )}
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
                {pendingDraft.candidateCategories.length > 1
                  ? "카테고리 선택"
                  : pendingDraft.existingCategories.includes(pendingDraft.candidateCategories[0])
                    ? "저장 확인"
                    : "새 서랍"}
              </span>
              <button onClick={() => setPendingDraft(null)} className="text-sm text-steel" aria-label="닫기">
                닫기
              </button>
            </div>
            <div className="overflow-y-auto">
              <p className="text-sm text-steel">{pendingDraft.summary}</p>

              {pendingDraft.schedule && (
                <div className="mt-3 rounded-lg bg-surface p-3">
                  <label className="flex items-start gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={addToCalendar}
                      onChange={(e) => {
                        setAddToCalendar(e.target.checked);
                        if (!e.target.checked) setRemindDayBefore(false);
                      }}
                      className="mt-1 accent-primary"
                    />
                    <span>
                      <strong className="tabular-nums">{pendingDraft.schedule.date}</strong> — {pendingDraft.schedule.label} 일정으로 캘린더에 추가할까요?
                    </span>
                  </label>
                  {addToCalendar && (
                    <label className="mt-2 ml-6 flex items-center gap-2 text-xs text-steel">
                      <input
                        type="checkbox"
                        checked={remindDayBefore}
                        onChange={(e) => setRemindDayBefore(e.target.checked)}
                        className="accent-primary"
                      />
                      하루 전에 알려드릴까요?
                    </label>
                  )}
                </div>
              )}

              {pendingDraft.candidateCategories.length > 1 ? (
                <>
                  <p className="mt-3 text-sm text-ink">
                    {pendingDraft.candidateCategories.map((c, i) => (
                      <span key={c}>
                        {i > 0 && " / "}
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-sm font-semibold"
                          style={{ backgroundColor: colorFor(c).bg, color: colorFor(c).text }}
                        >
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
                        onClick={() => confirmDraft(withExtras([c]))}
                        disabled={confirming}
                        className="h-11 w-full rounded-md border border-hairline-strong text-sm font-medium text-ink disabled:opacity-50"
                      >
                        {c}에만 저장
                      </button>
                    ))}
                    <button
                      onClick={() => confirmDraft(withExtras(pendingDraft.candidateCategories))}
                      disabled={confirming}
                      className="h-11 w-full rounded-md bg-primary text-sm font-medium text-on-primary disabled:opacity-50"
                    >
                      둘 다 저장
                    </button>
                  </div>
                </>
              ) : (
                (() => {
                  const category = pendingDraft.candidateCategories[0];
                  const isNew = !pendingDraft.existingCategories.includes(category);
                  const otherExisting = pendingDraft.existingCategories.filter((c) => c !== category);
                  return (
                    <>
                      <p className="mt-3 text-base text-ink">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-sm font-semibold"
                          style={{ backgroundColor: colorFor(category).bg, color: colorFor(category).text }}
                        >
                          {category}
                        </span>
                        {" "}
                        {isNew ? "서랍을 새로 만들까요?" : "서랍에 넣을까요?"}
                      </p>

                      {isNew && pendingDraft.suggestedMemos.length > 0 && (
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
                        onClick={() => confirmDraft(withExtras([category]))}
                        disabled={confirming}
                        className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-on-primary disabled:opacity-50"
                      >
                        {isNew ? "네, 새로 만들기" : "네, 저장"}
                      </button>
                      {otherExisting.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs text-steel">아니면 다른 서랍에 넣기</p>
                          <div className="flex flex-wrap gap-2">
                            {otherExisting.map((c) => (
                              <button
                                key={c}
                                onClick={() => confirmDraft(withExtras([c]))}
                                disabled={confirming}
                                className="rounded-full px-2 py-1 text-xs font-semibold disabled:opacity-50"
                                style={{ backgroundColor: colorFor(c).bg, color: colorFor(c).text }}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()
              )}

              {pendingDraft.existingCategories.filter((c) => !pendingDraft.candidateCategories.includes(c)).length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-steel">
                    이것도 다른 서랍에 같이 저장할까요? (예: 사케집 메모는 &quot;술&quot;이면서 &quot;맛집&quot;)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pendingDraft.existingCategories
                      .filter((c) => !pendingDraft.candidateCategories.includes(c))
                      .map((c) => (
                        <label
                          key={c}
                          className={`flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                            extraCategories.has(c) ? "ring-2 ring-primary" : ""
                          }`}
                          style={{ backgroundColor: colorFor(c).bg, color: colorFor(c).text }}
                        >
                          <input
                            type="checkbox"
                            checked={extraCategories.has(c)}
                            onChange={() => toggleExtraCategory(c)}
                            className="accent-primary"
                          />
                          {c}
                        </label>
                      ))}
                  </div>
                </div>
              )}

              <button
                onClick={async () => {
                  const name = await askText("새 카테고리 이름");
                  if (name?.trim()) confirmDraft(withExtras([name.trim()]));
                }}
                disabled={confirming}
                className="mt-4 text-xs text-steel underline disabled:opacity-50"
              >
                + 다른 이름으로 새 카테고리 만들기
              </button>
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
              <h3 className="font-heading text-xl font-bold text-ink">{selectedDrawer.name}</h3>
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

            <div className="mb-4 rounded-lg bg-surface p-3">
              <p className="mb-2 text-xs font-medium text-steel">함께 보는 사람</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {drawerMembers.map((m) => (
                  <span key={m.id} className="rounded-full bg-canvas px-2 py-0.5 text-xs text-ink">
                    {m.invited_email}
                    {m.status === "pending" && " (초대중)"}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInvite();
                  }}
                  placeholder="친구 이메일로 초대"
                  className="h-9 min-w-0 flex-1 rounded-md border border-hairline-strong bg-canvas px-3 text-xs text-ink outline-none focus:border-2 focus:border-primary"
                />
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="h-9 shrink-0 rounded-md bg-primary px-3 text-xs font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
                >
                  {inviting ? "초대 중..." : "초대"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {drawerLoading ? (
                <p className="text-sm text-steel">불러오는 중...</p>
              ) : drawerMemos.length === 0 ? (
                <EmptyState text="이 서랍이 비었어요." />
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
                        <p
                          className="cursor-pointer text-sm text-ink"
                          onClick={() => toggleExpand(m.id)}
                        >
                          {m.summary}
                        </p>
                        {expandedIds.has(m.id) && (
                          <p className="mt-2 whitespace-pre-line border-t border-hairline pt-2 text-sm text-steel">
                            {m.content}
                          </p>
                        )}
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

      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold text-ink">TOOK — 툭</h1>
          <p className="text-sm text-steel">
            아무 때나 툭 던져두세요. 필요할 때 제가 알아서 짠 꺼내드릴게요.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
          <span className="text-xs text-muted">{userEmail}</span>
          <button
            onClick={async () => {
              await getSupabaseBrowser().auth.signOut();
              router.refresh();
            }}
            className="text-xs text-steel underline"
          >
            로그아웃
          </button>
        </div>
      </header>

      <InstallPrompt />
      <ReminderOptIn />

      {activeTab === "input" && (
      <section className="rounded-lg border border-hairline bg-canvas p-6 shadow-[var(--shadow-1)]">
        <h2 className="mb-4 text-lg font-semibold text-ink">넣기</h2>
        <div className="flex gap-2">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="툭 던져보세요"
            className="h-11 min-w-0 flex-1 rounded-md border border-hairline-strong bg-canvas px-4 text-base text-ink outline-none focus:border-2 focus:border-primary"
          />
          <button
            onClick={handleSave}
            disabled={saving || !inputText.trim()}
            className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
          >
            {saving ? "먹는 중..." : "저장"}
          </button>
        </div>

        {saving && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas/95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BITE_FRAMES[chewFrame]} alt="" className="h-64 w-64 max-w-[70vw]" />
            <p className="text-base text-steel">아삭아삭... 어디에 넣을지 고민하는 중</p>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <label
            className={`cursor-pointer rounded-md border border-hairline-strong px-4 py-2 text-sm text-ink ${ocrLoading ? "pointer-events-none opacity-50" : ""}`}
          >
            📷 스크린샷·사진에서 텍스트 넣기
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={ocrLoading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
                e.target.value = "";
              }}
            />
          </label>
          {ocrLoading && <span className="text-xs text-steel">읽는 중...</span>}
        </div>
      </section>
      )}

      {activeTab === "drawers" && (
      <section className="rounded-lg border border-hairline bg-canvas p-6 shadow-[var(--shadow-1)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">서랍</h2>
          <button
            onClick={checkMergeSuggestions}
            disabled={mergeChecking || drawers.length < 2}
            className="text-xs text-steel underline disabled:text-muted disabled:no-underline"
          >
            {mergeChecking ? "확인 중..." : "🧹 비슷한 서랍 정리"}
          </button>
        </div>

        {mergeSuggestions && (
          <div className="mb-4 flex flex-col gap-2 rounded-lg bg-surface p-4">
            {mergeSuggestions.length === 0 ? (
              <p className="text-sm text-steel">합칠 만한 서랍이 안 보여요.</p>
            ) : (
              mergeSuggestions.map((s) => (
                <div key={s.into} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink">
                    {s.from.join(", ")} → <span className="font-medium">{s.into}</span>로 합칠까요?
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => applyMerge(s)}
                      disabled={mergingKey === s.into}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-on-primary disabled:bg-hairline"
                    >
                      {mergingKey === s.into ? "합치는 중..." : "합치기"}
                    </button>
                    <button onClick={() => dismissMerge(s.into)} className="text-xs text-steel">
                      건너뛰기
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {drawers.length === 0 ? (
          <EmptyState text="아직 만들어진 서랍이 없어요. 메모를 저장하면 자동으로 생겨요." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {drawers.map((d) => (
              <button
                key={d.id}
                onClick={() => openDrawer(d)}
                className="rounded-lg p-4 text-left transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: colorFor(d.name).bg, color: colorFor(d.name).text }}
              >
                <div className="font-heading text-base font-bold">
                  {d.name}
                  {d.memberCount > 1 && <span className="ml-1 text-xs opacity-70">👥{d.memberCount}</span>}
                </div>
                <div className="text-xs opacity-70">{d.count}개</div>
              </button>
            ))}
          </div>
        )}
      </section>
      )}

      {activeTab === "search" && (
      <section className="rounded-lg border border-hairline bg-canvas p-6 shadow-[var(--shadow-1)]">
        <h2 className="mb-4 text-lg font-semibold text-ink">꺼내기</h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="술"
            className="h-11 min-w-0 flex-1 rounded-md bg-surface px-4 text-base text-steel outline-none focus:border-2 focus:border-primary"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
          >
            {searching ? "검색 중..." : "검색"}
          </button>
        </div>

        {foundSplash && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas/95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/character/horse-excited.svg" alt="" className="h-64 w-64 max-w-[70vw]" />
            <p className="text-lg font-semibold text-ink">찾았어요!</p>
          </div>
        )}

        {searched && (
          <div className="mt-6 flex flex-col gap-6">
            {certain.length > 0 && (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/character/horse-excited.svg" alt="" className="h-10 w-10" />
                <p className="text-sm text-steel">찾았어요!</p>
              </div>
            )}
            <ResultGroup
              title={`확실한 결과 (${certain.length})`}
              memos={certain}
              drawers={drawers}
              onCategoryChange={handleCategoryChange}
              onDelete={handleDeleteMemo}
              askText={askText}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
            />
            <ResultGroup
              title={`혹시 이것도? (${maybe.length})`}
              memos={maybe}
              drawers={drawers}
              onCategoryChange={handleCategoryChange}
              onDelete={handleDeleteMemo}
              askText={askText}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              muted
            />
            {certain.length === 0 && maybe.length === 0 && (
              <EmptyState text="이건 아직 안 적어두셨네요" />
            )}
          </div>
        )}
      </section>
      )}

      {activeTab === "calendar" && <EmotionCalendar />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                activeTab === t.key ? "text-primary" : "text-muted"
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function ResultGroup({
  title,
  memos,
  drawers,
  onCategoryChange,
  onDelete,
  askText,
  expandedIds,
  onToggleExpand,
  muted,
}: {
  title: string;
  memos: Memo[];
  drawers: Drawer[];
  onCategoryChange: (memo: Memo, newCategory: string) => void;
  onDelete: (memo: Memo) => void;
  askText: (message: string, defaultValue?: string) => Promise<string | null>;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  muted?: boolean;
}) {
  if (memos.length === 0) return null;
  return (
    <div>
      <h3 className={`mb-2 text-sm font-medium ${muted ? "text-steel" : "text-ink"}`}>{title}</h3>
      <div className="flex flex-col gap-2">
        {memos.map((m) => (
          <div
            key={m.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-hairline bg-canvas p-4"
          >
            <div>
              <CategorySelect memo={m} drawers={drawers} onChange={(c) => onCategoryChange(m, c)} askText={askText} />
              {m.category_edited && <span className="ml-1 text-xs text-muted">(수정됨)</span>}
              <p className="cursor-pointer text-sm text-ink" onClick={() => onToggleExpand(m.id)}>
                {m.summary}
              </p>
              {expandedIds.has(m.id) && (
                <p className="mt-2 whitespace-pre-line border-t border-hairline pt-2 text-sm text-steel">
                  {m.content}
                </p>
              )}
            </div>
            <button
              aria-label="메모 삭제"
              onClick={() => onDelete(m)}
              className="shrink-0 text-xs text-muted hover:text-error"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
