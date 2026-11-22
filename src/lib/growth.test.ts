import { describe, expect, it } from "vitest";
import { cmInput, fmtChange, fmtLength, fmtWeight, kgInput, parseCm, parseKg, ticks } from "./growth";

describe("campos de medida", () => {
  it("lê peso em kg com vírgula ou ponto", () => {
    expect(parseKg("9,32")).toBe(9320);
    expect(parseKg("9.32")).toBe(9320);
    expect(parseKg(" 3,5 kg")).toBe(3500);
    expect(parseKg("2,045")).toBe(2045);
    expect(parseKg("12")).toBe(12000);
  });

  it("lê comprimento em cm", () => {
    expect(parseCm("75,1")).toBe(751);
    expect(parseCm("48")).toBe(480);
    expect(parseCm("102,5 cm")).toBe(1025);
  });

  it("recusa o que não é número de medida", () => {
    for (const v of ["", "abc", "9,3245", "-3", "123"]) expect(parseKg(v)).toBeNull();
    for (const v of ["", "7", "75,12", "1500,0"]) expect(parseCm(v)).toBeNull();
  });

  it("formata e volta para o campo sem perder casas", () => {
    expect(fmtWeight(9320)).toBe("9,32 kg");
    expect(fmtLength(751)).toBe("75,1 cm");
    expect(kgInput(9320)).toBe("9,32");
    expect(kgInput(2045)).toBe("2,045");
    expect(parseKg(kgInput(2045))).toBe(2045);
    expect(cmInput(480)).toBe("48,0");
  });

  it("mostra a diferença com sinal", () => {
    expect(fmtChange("weight", 420)).toBe("+420 g");
    expect(fmtChange("weight", -50)).toBe("−50 g");
    expect(fmtChange("weight", 1250)).toBe("+1.250 g");
    expect(fmtChange("length", 22)).toBe("+2,2 cm");
    expect(fmtChange("length", 0)).toBe("0,0 cm");
  });
});

describe("ticks", () => {
  it("cobre o intervalo com passos redondos", () => {
    expect(ticks(1.86, 9.32, 4)).toMatchObject({ from: 0, to: 10, step: 2 });
    expect(ticks(42.5, 75.1, 4)).toMatchObject({ from: 40, to: 80, step: 10 });
    expect(ticks(0, 17.3, 5).values).toEqual([0, 5, 10, 15, 20]);
  });

  it("não quebra com um ponto só", () => {
    const t = ticks(9.3, 9.3, 4);
    expect(t.to).toBeGreaterThan(t.from);
    expect(t.values.length).toBeGreaterThanOrEqual(2);
  });
});
