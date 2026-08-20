import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { contents, existingCategories } = await request.json();

  if (!Array.isArray(contents) || contents.length === 0) {
    return NextResponse.json({ error: "contents가 비어있습니다" }, { status: 400 });
  }

  const categories: string[] = Array.isArray(existingCategories) ? existingCategories : [];

  const summariesAndEmbeddings = await Promise.all(
    contents.map(async (content: string) => {
      const [summary, embedding] = await Promise.all([ai.summarize(content), ai.embed(content)]);
      return { content, summary, embedding };
    })
  );

  const summaries = summariesAndEmbeddings.map((r) => r.summary);
  const assignedCategories = await ai.classifyBatch(summaries, categories);

  const rows = summariesAndEmbeddings.map((r, i) => ({
    content: r.content,
    summary: r.summary,
    embedding: r.embedding,
    category: assignedCategories[i],
    source: "kakao" as const,
  }));

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("memos").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const newCategories = Array.from(new Set([...categories, ...assignedCategories]));

  return NextResponse.json({ inserted: rows.length, categories: newCategories });
}
