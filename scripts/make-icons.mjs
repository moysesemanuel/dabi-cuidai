// Gera os ícones PNG do PWA a partir da marca (assets/mark.svg: rosto da ursa do Cuidaí Kids).
// Uso: npm run icons
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });
const svg = readFileSync("assets/mark.svg");
const BRAND = "#0F6E6C";

// fill = quanto do lado do ícone a marca ocupa (maskable precisa de margem de segurança)
const render = async (size, fill) => {
  const inner = Math.round(size * fill);
  const mark = await sharp(svg, { density: 600 }).resize({ width: inner, height: inner, fit: "inside" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
};
const make = async (name, size, fill) => writeFileSync(`public/icons/${name}`, await render(size, fill));

/** favicon.ico com um PNG de 64 px dentro (formato aceito por todos os navegadores atuais). */
async function makeFavicon() {
  const png = await render(64, 0.82);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: ícone
  header.writeUInt16LE(1, 4); // uma imagem
  header.writeUInt8(64, 6); // largura
  header.writeUInt8(64, 7); // altura
  header.writeUInt16LE(1, 10); // planos de cor
  header.writeUInt16LE(32, 12); // bits por pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // onde a imagem começa
  writeFileSync("src/app/favicon.ico", Buffer.concat([header, png]));
}

await make("icon-192.png", 192, 0.74);
await make("icon-512.png", 512, 0.74);
await make("maskable-512.png", 512, 0.58);
await make("apple-touch-icon.png", 180, 0.74);
await makeFavicon();
console.log("ícones gerados em public/icons");
