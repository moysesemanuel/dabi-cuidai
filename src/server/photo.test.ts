import { describe, expect, it } from "vitest";
import { photoType } from "./repo";

const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("photoType", () => {
  it("reconhece WebP pelo cabeçalho RIFF....WEBP", () => {
    expect(photoType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp");
  });

  it("reconhece JPEG pela assinatura FF D8 FF", () => {
    expect(photoType(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe("image/jpeg");
  });

  it("recusa PNG, SVG e lixo", () => {
    expect(photoType(bytes([0x89], "PNG\r\n", [0x1a, 0x0a]))).toBeNull();
    expect(photoType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(photoType(bytes("RIFF", [0, 0, 0, 0], "WAVEfmt "))).toBeNull();
    expect(photoType(new Uint8Array())).toBeNull();
  });
});
