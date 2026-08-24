import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";
import type { DrawerMemberRow } from "@/lib/supabase/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from("drawer_members")
    .select("id, invited_email, status, user_id")
    .eq("drawer_id", id)
    .order("created_at", { ascending: true })
    .returns<Pick<DrawerMemberRow, "id" | "invited_email" | "status" | "user_id">[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ members: data });
}

/** 서랍에서 나가거나(본인) 다른 멤버를 내보낸다 — 동등한 권한이라 누구든 할 수 있음. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다" }, { status: 400 });
  }

  const { error } = await supabase.from("drawer_members").delete().eq("id", memberId).eq("drawer_id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
