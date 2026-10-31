// Gera os ícones PNG do PWA a partir da marca do logo (assets/mark.png: coração + faíscas).
// Uso: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

// fill = quanto do lado do ícone a marca ocupa (maskable precisa de margem de segurança)
const make = async (name, size, fill) => {
  const inner = Math.round(size * fill);
  const mark = await sharp("assets/mark.png")
    .resize({ width: inner, height: inner, fit: "inside" })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(`public/icons/${name}`);
};

await make("icon-192.png", 192, 0.82);
await make("icon-512.png", 512, 0.82);
await make("maskable-512.png", 512, 0.6);
await make("apple-touch-icon.png", 180, 0.82);
console.log("ícones gerados em public/icons");
