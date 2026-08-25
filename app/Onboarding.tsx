"use client";

import { useEffect, useState } from "react";

const SLIDES: { image: string; title: string; text: string; footer?: string }[] = [
  {
    image: "/character/horse-greet.svg",
    title: "안녕, 난 쥴라스야!",
    text: "여기 사는 말이야 🐴 (근데 개발자가 내 머리를 이렇게 잘라놨어... 앞머리 너무 쳐다보지 말고 그냥 내 얘기 들어봐 ㅋㅋ) 아무튼, 뭐든 툭 던져만 놔봐. 내가 알아서 어울리는 서랍에 쏙 넣어줄게. 맘에 안 들면 서랍 직접 만들어도 되고, 한 메모를 여러 서랍에 같이 넣어도 돼 — 욕심쟁이처럼.",
  },
  {
    image: "/character/horse-save-bite.svg",
    title: "타이핑 귀찮으면 사진으로 던져",
    text: "스크린샷이나 찍어둔 사진도 그냥 올려봐. 내가 글자 읽어서 대신 넣어줄게. 손가락 좀 아껴.",
  },
  {
    image: "/character/horse-watch.svg",
    title: "서랍은 같이 채워도 재밌어",
    text: "친구 이메일로 초대하면 같은 서랍을 같이 써. 누가 방금 뭐 넣었는지도 살짝 알려줄게 — 둘이 텔레파시 통하는 날도 있을걸?",
  },
  {
    image: "/character/horse-plead.svg",
    title: "나 자주 들를게, 약속",
    text: "던져두고 깜빡한 메모, 너무 쌓인 서랍 있으면 내가 가끔 콕 찔러줄게. 알림만 허용해두면 돼 — 귀찮게 안 굴고 딱 필요할 때만.",
  },
  {
    image: "/character/horse-excited.svg",
    title: "일기도 가볍게 툭",
    text: "\"일기\" 서랍 하나 만들어봐. 하루 기분이랑 같이 툭 기록해두면, 감정 캘린더에서 한 달치를 한눈에 훑어볼 수 있어.",
  },
  {
    image: "/character/horse-confused.svg",
    title: "꾹 누르면 숨은 기능이 나와",
    text: "서랍을 길게 누르면 이름을 바꾸거나 지울 수 있어. 같이 쓰는 서랍에선 친구 메모를 길게 눌러서 이모지로 짧게 반응도 남길 수 있어 — 댓글까진 아니고 딱 이모지 하나로.",
  },
  {
    image: "/character/horse-watch.svg",
    title: "뭐였더라... 싶을 때",
    text: "정확한 단어 기억 안 나도 괜찮아. 흐릿하게 대충 적어도 돼 — \"집안일 꿀팁\"처럼만 쳐도 관련된 메모들을 알아서 찾아줄게.",
    footer:
      "아 참, 닉네임은 계정 메뉴에서 언제든 바꿀 수 있어. 나는 쥴라스로 부르면 돼 ㅎㅎ\n그리고... 네가 나 자주 찾아와주면 개발자가 내 앞머리도 언젠가 길러주지 않을까? 나 사실 장발이 꿈이거든. 계속 놀러와 줄 거지?",
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
        {slide.footer && <p className="mt-3 whitespace-pre-line text-center text-xs text-muted">{slide.footer}</p>}

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
