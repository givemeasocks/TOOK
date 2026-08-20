export type RawMessage = {
  date: Date | null;
  sender: string;
  content: string;
};

// PC 버전: "2024년 1월 1일 오전 9:15, 홍길동 : 메시지"
// 구버전 모바일: "2024. 1. 1. 09:15, 홍길동 : 메시지"
const MESSAGE_LINE = new RegExp(
  "^(\\d{4})[년.]\\s*(\\d{1,2})[월.]\\s*(\\d{1,2})일?\\.?\\s*(오전|오후)\\s*(\\d{1,2}):(\\d{2}),\\s*(.+?)\\s*:\\s*(.*)$"
);

// "--------------- 2024년 1월 1일 월요일 ---------------" 형태의 날짜 구분선
const DATE_DIVIDER = /^-{3,}\s*\d{4}년\s*\d{1,2}월\s*\d{1,2}일.*-{3,}$/;

const HEADER_PREFIXES = ["카카오톡 대화", "저장한 날짜"];

function toDate(y: string, m: string, d: string, ampm: string, h: string, min: string): Date {
  let hour = Number(h) % 12;
  if (ampm === "오후") hour += 12;
  return new Date(Number(y), Number(m) - 1, Number(d), hour, Number(min));
}

export function parseKakaoExport(text: string): RawMessage[] {
  const lines = text.split(/\r\n|\r|\n/);
  const messages: RawMessage[] = [];
  let current: RawMessage | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (DATE_DIVIDER.test(line.trim())) continue;
    if (HEADER_PREFIXES.some((p) => line.trim().startsWith(p))) continue;

    const match = line.match(MESSAGE_LINE);
    if (match) {
      const [, y, m, d, ampm, h, min, sender, content] = match;
      current = { date: toDate(y, m, d, ampm, h, min), sender, content };
      messages.push(current);
    } else if (current) {
      // 여러 줄짜리 메시지의 이어지는 줄
      current.content += "\n" + line;
    }
  }

  return messages;
}

const BURST_GAP_MS = 2 * 60 * 1000;

/**
 * 같은 사람이 짧은 시간 안에 끊어 보낸 메시지들을 하나로 합친다.
 * 카톡은 한 생각을 여러 메시지로 쪼개 보내는 경우가 많아서,
 * 메시지 단위로만 처리하면 문맥이 끊기고 30자 미만 필터에 걸려 사라지기 쉽다.
 */
export function mergeBursts(messages: RawMessage[]): RawMessage[] {
  const merged: RawMessage[] = [];

  for (const msg of messages) {
    const last = merged[merged.length - 1];
    const withinBurst =
      last &&
      last.sender === msg.sender &&
      last.date &&
      msg.date &&
      msg.date.getTime() - last.date.getTime() <= BURST_GAP_MS;

    if (withinBurst && last) {
      last.content += "\n" + msg.content;
      last.date = msg.date;
    } else {
      merged.push({ ...msg });
    }
  }

  return merged;
}
