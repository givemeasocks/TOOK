// PWA/파비콘용 PNG 아이콘을 말 캐릭터 SVG(public/character/horse-app-icon.svg)에서 생성.
// 필요할 때(아이콘 원본 교체 등) 다시: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "public/character/horse-app-icon.svg");
const ICON_DIR = path.join(ROOT, "public/icons");

mkdirSync(ICON_DIR, { recursive: true });

const BG = "#F3E9DC"; // DESIGN_took.md 3.1 배경색

async function square(size, outFile) {
  await sharp(SOURCE, { density: 384 })
    .resize(size, size, { fit: "cover" })
    .flatten({ background: BG })
    .png()
    .toFile(outFile);
}

// 마스커블 아이콘: OS가 원형/둥근 사각형으로 잘라내므로 중앙 80% 안전영역에 들어가게 여백을 둠
async function maskable(size, outFile) {
  const inner = Math.round(size * 0.7);
  const iconBuf = await sharp(SOURCE, { density: 384 }).resize(inner, inner, { fit: "cover" }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: iconBuf, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) }])
    .png()
    .toFile(outFile);
}

await square(192, path.join(ICON_DIR, "icon-192.png"));
await square(512, path.join(ICON_DIR, "icon-512.png"));
await maskable(512, path.join(ICON_DIR, "icon-maskable-512.png"));
await square(180, path.join(ROOT, "public/apple-touch-icon.png"));
await square(512, path.join(ROOT, "app/icon.png"));
await square(180, path.join(ROOT, "app/apple-icon.png"));

console.log("아이콘 생성 완료");
