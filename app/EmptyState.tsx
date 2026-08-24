// DESIGN_took.md 5.2: 검색 결과 없음 / 첫 사용 / 서랍 비어있음 — 자는 말 일러스트 + 다정한 문구
export default function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/character/horse-sleeping.svg" alt="" className="h-16 w-16 opacity-90" />
      <p className="text-sm text-steel">{text}</p>
    </div>
  );
}
