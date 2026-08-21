import sharp from "sharp";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300">
  <rect width="600" height="300" fill="white"/>
  <text x="30" y="80" font-size="28" font-family="sans-serif" fill="black">매실 담글 때 소주 대신</text>
  <text x="30" y="130" font-size="28" font-family="sans-serif" fill="black">청주로 해보니 훨씬 부드러움</text>
</svg>
`;

await sharp(Buffer.from(svg)).png().toFile(process.argv[2]);
console.log("done");
