import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";
import {
  countMemosAndMembers,
  findDrawerIdByName,
  latestMemoAuthors,
  latestMemoPreviews,
  listMemberDrawers,
  memberEmailsByDrawer,
  nicknamesByUserId,
} from "@/lib/drawers";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const memberDrawers = listDeduped(await listMemberDrawers(supabase, user.id));
  const ids = memberDrawers.map((d) => d.id);
  const [{ memoCounts, memberCounts }, previews, latestAuthors, emailsByDrawer] = await Promise.all([
    countMemosAndMembers(supabase, ids),
    latestMemoPreviews(supabase, ids),
    latestMemoAuthors(supabase, ids),
    memberEmailsByDrawer(supabase, ids),
  ]);
  const otherAuthorIds = [...latestAuthors.values()].map((v) => v.userId).filter((id): id is string => !!id);
  const nicknames = await nicknamesByUserId(supabase, otherAuthorIds);

  const drawers = memberDrawers
    .map((d) => {
      const memberCount = memberCounts.get(d.id) ?? 1;
      const latest = latestAuthors.get(d.id);
      // 개인 서랍(멤버 1명)에선 "내가 마지막으로 넣음"이 당연해서 표시할 필요 없음 — 공동 서랍에서만 의미 있음.
      const lastAuthorName =
        memberCount > 1 && latest?.userId && latest.userId !== user.id
          ? (nicknames.get(latest.userId) ?? emailsByDrawer.get(d.id)?.get(latest.userId) ?? null)
          : null;
      return {
        id: d.id,
        name: d.name,
        count: memoCounts.get(d.id) ?? 0,
        memberCount,
        preview: previews.get(d.id) ?? null,
        createdAt: d.createdAt,
        lastAuthorName,
      };
    })
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ drawers });
}

// 이름이 같은 서랍이 여러 개면(내 개인 서랍 + 공유받은 동명 서랍) 목록에는 하나로만 보여준다.
function listDeduped<T extends { id: string; name: string }>(drawers: T[]): T[] {
  const seen = new Set<string>();
  return drawers.filter((d) => {
    if (seen.has(d.name)) return false;
    seen.add(d.name);
    return true;
  });
}

/** 서랍(이름) 이름을 바꾼다. 바꾸려는 이름의 서랍이 이미 있으면, 그 서랍으로 메모를 합치고 원래 서랍은 지운다. */
export async function PATCH(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { name, newName } = await request.json();

  if (typeof name !== "string" || !name.trim() || typeof newName !== "string" || !newName.trim()) {
    return NextResponse.json({ error: "name, newName이 필요합니다" }, { status: 400 });
  }

  const sourceId = await findDrawerIdByName(supabase, user.id, name);
  if (!sourceId) {
    return NextResponse.json({ error: "서랍을 찾을 수 없습니다" }, { status: 404 });
  }

  const targetId = await findDrawerIdByName(supabase, user.id, newName.trim());

  if (targetId && targetId !== sourceId) {
    const { data: moved, error: moveError } = await supabase
      .from("memos")
      .update({ drawer_id: targetId, category_edited: true })
      .eq("drawer_id", sourceId)
      .select("id");
    if (moveError) {
      return NextResponse.json({ error: moveError.message }, { status: 500 });
    }
    await supabase.from("drawers").delete().eq("id", sourceId);
    return NextResponse.json({ renamed: moved?.length ?? 0 });
  }

  const { error } = await supabase.from("drawers").update({ name: newName.trim() }).eq("id", sourceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("memos").update({ category_edited: true }).eq("drawer_id", sourceId);

  const { count: memoCount } = await supabase
    .from("memos")
    .select("id", { count: "exact", head: true })
    .eq("drawer_id", sourceId);

  return NextResponse.json({ renamed: memoCount ?? 0 });
}

/** 서랍을 통째로 삭제한다. 안에 있던 메모도 함께 삭제됨. */
export async function DELETE(request: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const name = request.nextUrl.searchParams.get("name");

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name이 필요합니다" }, { status: 400 });
  }

  const drawerId = await findDrawerIdByName(supabase, user.id, name);
  if (!drawerId) {
    return NextResponse.json({ deleted: 0 });
  }

  const { count } = await supabase
    .from("memos")
    .select("id", { count: "exact", head: true })
    .eq("drawer_id", drawerId);

  const { error } = await supabase.from("drawers").delete().eq("id", drawerId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? 0 });
}
