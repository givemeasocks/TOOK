import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { category } = await request.json();

  if (typeof category !== "string" || !category.trim()) {
    return NextResponse.json({ error: "category가 비어있습니다" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("memos")
    .update({ category: category.trim(), category_edited: true })
    .eq("id", id)
    .select("id, category, category_edited")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ memo: data });
}
