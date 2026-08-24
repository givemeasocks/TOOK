// DESIGN_took.md 5.3: 시스템 문구/네비게이션은 캐릭터나 이모지가 아니라 심플한 라인 아이콘을 쓴다.
// 아이콘 패키지를 새로 추가하지 않고 최소한의 인라인 SVG로 직접 그림 — currentColor라 탭바의
// 활성/비활성 텍스트 색(text-primary/text-muted)을 그대로 물려받는다.
type TabIconName = "input" | "drawers" | "search" | "calendar";

export function TabIcon({ name, className }: { name: TabIconName; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "input":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
        </svg>
      );
    case "drawers":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="7" width="18" height="4" rx="1" />
          <path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8" />
          <path d="M10 14h4" />
        </svg>
      );
    case "search":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 21 21" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
        </svg>
      );
  }
}
