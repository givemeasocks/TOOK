import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/serverClient";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image 파일이 필요합니다" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "이미지가 너무 커요 (10MB 이하만)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await ai.ocr(buffer.toString("base64"), file.type);

  return NextResponse.json({ text });
}
