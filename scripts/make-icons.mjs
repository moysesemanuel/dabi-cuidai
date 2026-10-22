// Gera os ícones PNG do PWA a partir de um SVG (a pílula sorridente).
// Uso: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const pill = `
<g transform="rotate(-30 40 40)">
  <path d="M28 24h12v32H28a16 16 0 0 1 0-32z" fill="#fff"/>
  <path d="M40 24h12a16 16 0 0 1 0 32H40z" fill="#FF8A7A"/>
  <rect x="12" y="24" width="56" height="32" rx="16" fill="none" stroke="#1F2A44" stroke-width="3"/>
  <path d="M40 24v32" stroke="#1F2A44" stroke-width="3"/>
  <circle cx="29" cy="37" r="2.4" fill="#1F2A44"/><circle cx="51" cy="37" r="2.4" fill="#1F2A44"/>
  <path d="M33 45c4 4 10 4 14 0" stroke="#1F2A44" stroke-width="3" fill="none" stroke-linecap="round"/>
</g>`;

// scale = quanto da área o desenho ocupa (maskable precisa de margem de segurança)
const svg = (scale) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FFD54A"/>
  <g transform="translate(${256 - 40 * scale * 6.4 * 0.5 * 2} ${256 - 40 * scale * 6.4 * 0.5 * 2}) scale(${scale * 6.4})">${pill}</g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const make = async (name, size, scale) =>
  sharp(Buffer.from(svg(scale))).resize(size, size).png().toFile(`public/icons/${name}`);

await make("icon-192.png", 192, 0.9);
await make("icon-512.png", 512, 0.9);
await make("maskable-512.png", 512, 0.62);
await make("apple-touch-icon.png", 180, 0.9);
writeFileSync(
  "public/icons/icon.svg",
  svg(0.9).replace('width="512" height="512"', 'width="512" height="512"'),
);
console.log("ícones gerados em public/icons");
