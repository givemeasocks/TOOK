import { NextRequest, NextResponse } from "next/server";
import { savePendingShare } from "@/lib/pendingShares";
import { requireUser } from "@/lib/supabase/serverClient";

/** OS 공유 시트에서 "TOOK"을 골랐을 때 브라우저가 여기로 POST한다 (app/manifest.ts share_target 참고). */
export async function POST(request: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url), 303);

  const formData = await request.formData();
  const title = formData.get("title")?.toString().trim() ?? "";
  const text = formData.get("text")?.toString().trim() ?? "";
  const url = formData.get("url")?.toString().trim() ?? "";

  const content = [title, text, url].filter(Boolean).join("\n");

  if (!content) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const shareId = savePendingShare(content);
  return NextResponse.redirect(new URL(`/?shared=${shareId}`, request.url), 303);
}
