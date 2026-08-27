import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/serverClient";
import { drawerMemoStats, listMemberDrawers } from "@/lib/drawers";

/** PRD 7.5 과분할 방지: 현재 서랍 목록을 보고 병합할 만한 것들을 LLM이 제안한다. */
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const drawers = dedupeByName(await listMemberDrawers(supabase, user.id));
  if (drawers.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const { memoCounts } = await drawerMemoStats(
    supabase,
    drawers.map((d) => d.id)
  );
  const categories = drawers.map((d) => ({ name: d.name, count: memoCounts.get(d.id) ?? 0 }));

  const suggestions = await ai.suggestMerges(categories);
  return NextResponse.json({ suggestions });
}

function dedupeByName(drawers: { id: string; name: string }[]) {
  const seen = new Set<string>();
  return drawers.filter((d) => {
    if (seen.has(d.name)) return false;
    seen.add(d.name);
    return true;
  });
}
