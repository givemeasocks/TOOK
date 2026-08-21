import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TOOK — 툭",
    short_name: "TOOK",
    description: "툭 던져두면, 필요할 때 알아서 나타나는 개인 아카이브",
    start_url: "/",
    display: "standalone",
    background_color: "#F3E9DC",
    theme_color: "#C97F4A",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // PRD의 "공유 시트"(다른 앱 → TOOK으로 텍스트/링크 전송)를 웹 표준 Web Share Target으로 구현.
    // 이미지 공유는 다음 단계(OCR 업로드)에서 별도로 다룬다.
    share_target: {
      action: "/api/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
