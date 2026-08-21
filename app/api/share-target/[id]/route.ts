import { NextRequest, NextResponse } from "next/server";
import { takePendingShare } from "@/lib/pendingShares";

/** 클라이언트가 /?shared=ID로 열렸을 때 그 내용을 한 번만 꺼내온다. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const content = takePendingShare(id);

  if (!content) {
    return NextResponse.json({ error: "만료되었거나 존재하지 않는 공유입니다" }, { status: 404 });
  }
  return NextResponse.json({ content });
}
