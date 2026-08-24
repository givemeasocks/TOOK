import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/serverClient";

/** 이메일로 서랍에 초대한다. 이미 가입한 이메일이면 바로 멤버가 되고, 아니면 가입할 때까지 초대중 상태로 남는다. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  const { email } = await request.json();

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "email이 필요합니다" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("invite_to_drawer", {
    p_drawer_id: id,
    p_email: email.trim().toLowerCase(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ member: data });
}
