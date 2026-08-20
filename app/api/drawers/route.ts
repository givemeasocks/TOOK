import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MemoRow } from "@/lib/supabase/types";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("memos")
    .select("category")
    .not("category", "is", null)
    .returns<Pick<MemoRow, "category">[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const category = row.category as string;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const drawers = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ drawers });
}

/** 서랍(카테고리) 이름을 일괄 변경한다. 잘못 만들어진 카테고리명을 고칠 때 씀. */
export async function PATCH(request: NextRequest) {
  const { name, newName } = await request.json();

  if (typeof name !== "string" || !name.trim() || typeof newName !== "string" || !newName.trim()) {
    return NextResponse.json({ error: "name, newName이 필요합니다" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error, count } = await supabase
    .from("memos")
    .update({ category: newName.trim(), category_edited: true }, { count: "exact" })
    .eq("category", name);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ renamed: count ?? 0 });
}

/** 서랍(카테고리)을 통째로 삭제한다. 안에 있던 메모도 함께 삭제됨 — 잘못 생성된 서랍 정리용. */
export async function DELETE(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name이 필요합니다" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error, count } = await supabase
    .from("memos")
    .delete({ count: "exact" })
    .eq("category", name);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? 0 });
}
