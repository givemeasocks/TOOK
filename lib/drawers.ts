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

/** 주어진 서랍 id들의 (user_id → invited_email) 맵을, 서랍별로 묶어서 돌려준다. 작성자 표기/기여 카운트에 씀. */
export async function memberEmailsByDrawer(supabase: SupabaseClient, drawerIds: string[]) {
  const byDrawer = new Map<string, Map<string, string>>();
  if (drawerIds.length === 0) return byDrawer;

  const { data, error } = await supabase
    .from("drawer_members")
    .select("drawer_id, user_id, invited_email")
    .eq("status", "accepted")
    .in("drawer_id", drawerIds);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { drawer_id: string; user_id: string | null; invited_email: string }[]) {
    if (!row.user_id) continue;
    if (!byDrawer.has(row.drawer_id)) byDrawer.set(row.drawer_id, new Map());
    byDrawer.get(row.drawer_id)!.set(row.user_id, row.invited_email);
  }
  return byDrawer;
}

/** 주어진 서랍 id들의 가장 최근 메모 작성자(user_id)와 생성 시각을 맵으로 돌려준다. */
export async function latestMemoAuthors(supabase: SupabaseClient, drawerIds: string[]) {
  const latest = new Map<string, { userId: string | null; createdAt: string }>();
  if (drawerIds.length === 0) return latest;

  const { data, error } = await supabase
    .from("memos")
    .select("drawer_id, user_id, created_at")
    .in("drawer_id", drawerIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { drawer_id: string; user_id: string | null; created_at: string }[]) {
    if (!latest.has(row.drawer_id)) {
      latest.set(row.drawer_id, { userId: row.user_id, createdAt: row.created_at });
    }
  }
  return latest;
}

/** 주어진 서랍 id들의 메모 개수 / 멤버 개수를 한 번씩만 조회해서 맵으로 돌려준다. */
export async function countMemosAndMembers(supabase: SupabaseClient, drawerIds: string[]) {
  const memoCounts = new Map<string, number>();
  const memberCounts = new Map<string, number>();
  if (drawerIds.length === 0) return { memoCounts, memberCounts };

  const [{ data: memos, error: memosError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("memos").select("drawer_id").in("drawer_id", drawerIds),
    supabase.from("drawer_members").select("drawer_id").eq("status", "accepted").in("drawer_id", drawerIds),
  ]);
  if (memosError) throw new Error(memosError.message);
  if (membersError) throw new Error(membersError.message);

  for (const row of (memos ?? []) as { drawer_id: string }[]) {
    memoCounts.set(row.drawer_id, (memoCounts.get(row.drawer_id) ?? 0) + 1);
  }
  for (const row of (members ?? []) as { drawer_id: string }[]) {
    memberCounts.set(row.drawer_id, (memberCounts.get(row.drawer_id) ?? 0) + 1);
  }
  return { memoCounts, memberCounts };
}

/** 주어진 서랍 id들의 최신 메모 한 줄 미리보기(요약 없으면 본문 앞부분)를 맵으로 돌려준다. */
export async function latestMemoPreviews(supabase: SupabaseClient, drawerIds: string[]) {
  const previews = new Map<string, string>();
  if (drawerIds.length === 0) return previews;

  const { data, error } = await supabase
    .from("memos")
    .select("drawer_id, summary, content, created_at")
    .in("drawer_id", drawerIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { drawer_id: string; summary: string | null; content: string }[]) {
    if (!previews.has(row.drawer_id)) {
      previews.set(row.drawer_id, row.summary ?? row.content.slice(0, 40));
    }
  }
  return previews;
}
