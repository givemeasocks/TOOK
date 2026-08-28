// One-off generator for public/og-image.png and app/opengraph-image.png.
// Run with: node scripts/generate-og-image.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import React from "react";
import { ImageResponse } from "next/og.js";

const ROOT = path.resolve(import.meta.dirname, "..");

const bold = fs.readFileSync(
  path.join(ROOT, "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf")
);
const semibold = fs.readFileSync(
  path.join(ROOT, "node_modules/pretendard/dist/public/static/Pretendard-SemiBold.otf")
);
const medium = fs.readFileSync(
  path.join(ROOT, "node_modules/pretendard/dist/public/static/Pretendard-Medium.otf")
);

const horsePng = await sharp(path.join(ROOT, "public/character/horse-shoulder-hug.svg"), {
  density: 400,
})
  .resize(620, 620, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const horseDataUri = `data:image/png;base64,${horsePng.toString("base64")}`;

const e = React.createElement;

const element = e(
  "div",
  {
    style: {
      width: "1200px",
      height: "630px",
      display: "flex",
      position: "relative",
      background: "#fbf6ee",
      fontFamily: "Pretendard",
    },
  },
  // soft decorative circle behind the character
  e("div", {
    style: {
      position: "absolute",
      right: "-60px",
      bottom: "-120px",
      width: "620px",
      height: "620px",
      borderRadius: "620px",
      background: "#f3e9dc",
      display: "flex",
    },
  }),
  // text block
  e(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 0 0 88px",
        width: "700px",
        height: "100%",
      },
    },
    e(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "baseline",
          gap: "18px",
        },
      },
      e(
        "span",
        {
          style: {
            fontSize: "128px",
            fontWeight: 700,
            color: "#c97f4a",
            letterSpacing: "-2px",
          },
        },
        "TOOK"
      ),
      e(
        "span",
        {
          style: {
            fontSize: "56px",
            fontWeight: 600,
            color: "#3a2e22",
          },
        },
        "— 툭"
      )
    ),
    e(
      "div",
      {
        style: {
          marginTop: "32px",
          display: "flex",
          flexDirection: "column",
          fontSize: "34px",
          fontWeight: 500,
          color: "#4a3d2e",
          lineHeight: 1.5,
        },
      },
      e("span", null, "아무 때나 툭 던져두세요."),
      e("span", null, "필요할 때 제가 알아서 짠 꺼내드릴게요.")
    )
  ),
  // character
  e("img", {
    src: horseDataUri,
    width: 560,
    height: 560,
    style: {
      position: "absolute",
      right: "20px",
      bottom: "10px",
    },
  })
);

const image = new ImageResponse(element, {
  width: 1200,
  height: 630,
  fonts: [
    { name: "Pretendard", data: bold, weight: 700, style: "normal" },
    { name: "Pretendard", data: semibold, weight: 600, style: "normal" },
    { name: "Pretendard", data: medium, weight: 500, style: "normal" },
  ],
});

const buffer = Buffer.from(await image.arrayBuffer());

const outPublic = path.join(ROOT, "public/og-image.png");
const outAppConvention = path.join(ROOT, "app/opengraph-image.png");
fs.writeFileSync(outPublic, buffer);
fs.writeFileSync(outAppConvention, buffer);
console.log("written:", outPublic, outAppConvention, buffer.length, "bytes");
