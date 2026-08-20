import { NextResponse } from "next/server";
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
