import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOOK — 툭",
  description: "아무 때나 툭 던져두세요. 필요할 때 제가 알아서 짠 꺼내드릴게요.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TOOK",
  },
};

export const viewport: Viewport = {
  themeColor: "#C97F4A",
};

// 임시 진단용: 카카오톡 인앱 브라우저/홈화면 PWA에서만 흰 화면이 뜨는 버그를 원격으로 재현할 수가
// 없어서, React 번들과 무관하게 무조건 실행되는 순수 인라인 스크립트로 전역 에러를 화면에 직접
// 찍는다(콘솔 접근이 안 되는 환경에서 사용자가 읽어서 알려줄 수 있게). 원인 확인되면 지울 것.
const DIAGNOSTIC_SCRIPT = `
(function () {
  function show(text) {
    var el = document.getElementById("__diag");
    if (!el) {
      el = document.createElement("div");
      el.id = "__diag";
      el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff;color:#c00;font:12px monospace;padding:8px;white-space:pre-wrap;max-height:50vh;overflow:auto;border-bottom:2px solid #c00;";
      document.body.appendChild(el);
    }
    el.textContent += text + "\\n";
  }
  window.addEventListener("error", function (e) {
    show("[error] " + e.message + " @ " + e.filename + ":" + e.lineno);
  });
  window.addEventListener("unhandledrejection", function (e) {
    show("[promise] " + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
  });
  setTimeout(function () {
    if (!document.getElementById("__diag")) show("[diag] 5초 지나도 에러 없음 (JS는 도는데 렌더링이 안 된 것일 수도)");
  }, 5000);
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: DIAGNOSTIC_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
