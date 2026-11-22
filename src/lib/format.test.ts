import { describe, expect, it } from "vitest";
import { greeting } from "./format";

const at = (h: number, m = 0) => new Date(2026, 10, 21, h, m).getTime();

describe("greeting", () => {
  it("muda com a hora do aparelho", () => {
    expect(greeting(at(5))).toBe("Bom dia!");
    expect(greeting(at(11, 59))).toBe("Bom dia!");
    expect(greeting(at(12))).toBe("Boa tarde!");
    expect(greeting(at(18))).toBe("Boa noite!");
    expect(greeting(at(4, 59))).toBe("Boa noite!");
  });

  it("usa só o primeiro nome", () => {
    expect(greeting(at(9), "  Ana Maria Souza ")).toBe("Bom dia, Ana!");
    expect(greeting(at(9), "   ")).toBe("Bom dia!");
  });
});
