import { NextRequest, NextResponse } from "next/server";
import { parseKakaoExport } from "@/lib/kakao/parser";
import { isNoiseMessage } from "@/lib/kakao/filter";

const MAX_MESSAGES = 2000;

export async function POST(request: NextRequest) {
  const { text } = await request.json();
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text가 비어있습니다" }, { status: 400 });
  }

  const parsed = parseKakaoExport(text);
  let contents = parsed
    .map((m) => m.content.trim())
    .filter((c) => !isNoiseMessage(c));

  const totalParsed = parsed.length;
  const totalFiltered = contents.length;

  // 최대 2000건, 초과 시 최근 것부터 (파일 뒤쪽이 최신이라는 카톡 내보내기 순서 전제)
  if (contents.length > MAX_MESSAGES) {
    contents = contents.slice(contents.length - MAX_MESSAGES);
  }

  return NextResponse.json({
    contents,
    totalParsed,
    totalFiltered,
    totalUsed: contents.length,
  });
}
