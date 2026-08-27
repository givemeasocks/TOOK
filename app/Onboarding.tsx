"use client";

import { useEffect, useState } from "react";

const SLIDES: { image: string; title: string; text: string }[] = [
  {
    image: "/character/onboarding-01-shy-bangs.svg",
    title: "안녕, 난 쥴라스야",
    text: "여기 사는 말이야 🐴 어이 거기, 귀여운 내 앞머리만 너무 쳐다보지 말고 얘기에 집중하라구! 💢 집중 못한 아이는 우측 상단에서 내 멋진 설명을 다시 볼 수 있게 해뒀어.",
  },
  {
    image: "/character/onboarding-02-drawers.svg",
    title: "여기, 내 서랍장이야",
    text: "앞으로 뭐든 툭 던져봐. 내용을 분석해서 멋진 서랍명을 지어줄게. 물론 마음에 안 들면 직접 만들어도 되고, 한 메모를 여러 서랍에 중복해서 넣어도 돼.",
  },
  {
    image: "/character/onboarding-03-photo-toss.svg",
    title: "타이핑 귀찮으면 사진으로 던져",
    text: "스크린샷이나 사진 그대로 던져도 돼. 글자는 내가 대신 읽어줄게.",
  },
  {
    image: "/character/onboarding-04-telepathy.svg",
    title: "서랍, 같이 채우면 더 재밌어",
    text: "친구 이메일로 초대하면 같은 서랍을 같이 써. 누가 방금 뭘 넣었는지 알려주고, 각자 몇 개 채웠는지도 살짝 보여줄게. 같은 날 둘 다 저장하면? 우리 텔레파시 통한 거다! 재밌게 즐겨보라구",
  },
  {
    image: "/character/onboarding-05-wide-view.svg",
    title: "잊어버린 것도 내가 콕 찔러줄게",
    text: "던져두고 까먹은 거, 나는 다 보고 있어. 내 시야는 350도라 놓치는 게 별로 없거든. 먼지 쌓인 서랍 있으면 알려줄게.",
  },
  {
    image: "/character/onboarding-06-diary.svg",
    title: "일기도 가볍게 툭",
    text: "\"일기\" 서랍 하나 만들어봐. 기분이랑 같이 툭 적어두면, 캘린더에서 한 달치를 편하게 볼 수 있어.",
  },
  {
    image: "/character/onboarding-07-hidden-feature.svg",
    title: "꾹 누르면 숨은 기능이 나와",
    text: "서랍을 길게 누르면 이름 바꾸기·삭제가 떠. 같이 쓰는 서랍이면 친구 메모를 꾹 눌러서 이모지로 반응도 남길 수 있어.",
  },
  {
    image: "/character/onboarding-08-fuzzy-search.svg",
    title: "뭐였더라... 싶을 때",
    text: "정확한 단어 몰라도 괜찮아. \"집안일 꿀팁\"처럼 대충 쳐도, '꺼내기'에서 관련된 메모를 모조리 찾아줄게. 툭 던져두고 잊은 메모도 내가 다 기억하고 있으니까 걱정마",
  },
  {
    image: "/character/onboarding-09-see-you-again.svg",
    title: "이제 진짜 시작이야",
    text: "아 참, 닉네임은 계정 메뉴에서 언제든 바꿀 수 있어. 자주 놀러 와 줄 거지? 사실 나.. 장발이 꿈이거든. 네가 자주 찾아주면 개발자가 미용실에 데려가줄지도 모르잖아! 앞으로 잘 부탁해. 자주 보자!",
  },
];

export default function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);

  // "기능 둘러보기"로 다시 열 때는 지난번에 멈춘 곳이 아니라 항상 처음부터 보여준다.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-deep/40 px-4">
      <div className="w-full max-w-[22rem] rounded-lg bg-canvas p-5 shadow-[var(--shadow-4)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.image} alt="" className="mx-auto mb-3 h-24 w-24" />
        <h2 className="text-center text-base font-bold text-ink">{slide.title}</h2>
        <p className="mt-1.5 whitespace-pre-line text-center text-sm text-steel">{slide.text}</p>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-primary" : "bg-hairline"}`} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={onClose} className="text-sm text-steel">
            건너뛰기
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="rounded-md px-3 py-1.5 text-sm text-steel">
                이전
              </button>
            )}
            <button
              onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-on-primary"
            >
              {isLast ? "시작하기" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
