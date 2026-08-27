import type { SupabaseClient } from "@supabase/supabase-js";

/** 내가 멤버로 들어가 있는 서랍 중 이름이 일치하는 서랍의 id. 여러 개면 가장 먼저 만들어진 것. */
export async function findDrawerIdByName(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("drawer_members")
    .select("drawer_id, drawers!inner(name)")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .eq("drawers.name", name)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.drawer_id ?? null;
}

/** 없으면 본인 소유로 새로 만들어서 id를 반환한다. */
export async function findOrCreateDrawerId(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
  name: string
): Promise<string> {
  const existing = await findDrawerIdByName(supabase, userId, name);
  if (existing) return existing;

  const { data: drawer, error } = await supabase
    .from("drawers")
    .insert({ name, owner_id: userId })
    .select("id")
    .single();
  if (error || !drawer) throw new Error(error?.message ?? "서랍 생성 실패");

  const { error: memberError } = await supabase
    .from("drawer_members")
    .insert({ drawer_id: drawer.id, user_id: userId, invited_email: userEmail.toLowerCase(), status: "accepted" });
  if (memberError) throw new Error(memberError.message);

  return drawer.id as string;
}

/** 내가 멤버로 들어가 있는 모든 서랍을 {id, name, createdAt} 목록으로 반환한다 (중복 이름 포함, 호출부에서 필요시 dedup). */
export async function listMemberDrawers(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; name: string; createdAt: string }[]> {
  const { data, error } = await supabase
    .from("drawer_members")
    .select("drawer_id, drawers!inner(id, name, created_at)")
    .eq("user_id", userId)
    .eq("status", "accepted");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const drawer = r.drawers as unknown as { id: string; name: string; created_at: string };
    return { id: drawer.id, name: drawer.name, createdAt: drawer.created_at };
  });
}

/** 주어진 서랍 id들의 멤버 수와 (user_id → invited_email) 맵을 drawer_members 테이블 한 번만 훑어서 계산한다. */
export async function drawerMemberStats(supabase: SupabaseClient, drawerIds: string[]) {
  const memberCounts = new Map<string, number>();
  const emailsByDrawer = new Map<string, Map<string, string>>();
  if (drawerIds.length === 0) return { memberCounts, emailsByDrawer };

  const { data, error } = await supabase
    .from("drawer_members")
    .select("drawer_id, user_id, invited_email")
    .eq("status", "accepted")
    .in("drawer_id", drawerIds);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { drawer_id: string; user_id: string | null; invited_email: string }[]) {
    memberCounts.set(row.drawer_id, (memberCounts.get(row.drawer_id) ?? 0) + 1);
    if (!row.user_id) continue;
    if (!emailsByDrawer.has(row.drawer_id)) emailsByDrawer.set(row.drawer_id, new Map());
    emailsByDrawer.get(row.drawer_id)!.set(row.user_id, row.invited_email);
  }
  return { memberCounts, emailsByDrawer };
}

/** 주어진 user_id들의 닉네임을 (user_id → nickname) 맵으로 돌려준다. 프로필이 아직 없으면 그 user_id는 맵에서 빠짐. */
export async function nicknamesByUserId(supabase: SupabaseClient, userIds: string[]) {
  const map = new Map<string, string>();
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return map;

  const { data, error } = await supabase.from("profiles").select("user_id, nickname").in("user_id", uniqueIds);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { user_id: string; nickname: string }[]) {
    map.set(row.user_id, row.nickname);
  }
  return map;
}

/**
 * 주어진 서랍 id들의 메모 개수 / 최신 작성자 / 최신 미리보기를 memos 테이블 한 번만 훑어서 계산한다.
 * (예전엔 이 셋을 각각 따로 조회해서 같은 테이블을 세 번 스캔했음 — 서랍/메모가 늘수록 느려지는 원인이었어서 합침)
 */
export async function drawerMemoStats(supabase: SupabaseClient, drawerIds: string[]) {
  const memoCounts = new Map<string, number>();
  const latestAuthors = new Map<string, { userId: string | null; createdAt: string }>();
  const previews = new Map<string, string>();
  if (drawerIds.length === 0) return { memoCounts, latestAuthors, previews };

  const { data, error } = await supabase
    .from("memos")
    .select("drawer_id, user_id, summary, content, created_at")
    .in("drawer_id", drawerIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as {
    drawer_id: string;
    user_id: string | null;
    summary: string | null;
    content: string;
    created_at: string;
  }[]) {
    memoCounts.set(row.drawer_id, (memoCounts.get(row.drawer_id) ?? 0) + 1);
    if (!latestAuthors.has(row.drawer_id)) {
      latestAuthors.set(row.drawer_id, { userId: row.user_id, createdAt: row.created_at });
      previews.set(row.drawer_id, row.summary ?? row.content.slice(0, 40));
    }
  }
  return { memoCounts, latestAuthors, previews };
}
