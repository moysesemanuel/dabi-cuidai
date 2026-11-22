import { describe, expect, it } from "vitest";
import { parseGrowthInput } from "./growth";

const today = { y: 2026, m: 11, d: 21 };
const parse = (body: Record<string, unknown>) => parseGrowthInput({ childId: 1, measuredOn: "2026-11-10", ...body }, today);

describe("parseGrowthInput", () => {
  it("aceita só peso, só comprimento ou os dois", () => {
    expect(parse({ weightG: 9320 })).toMatchObject({ weightG: 9320, lengthMm: null, note: "" });
    expect(parse({ lengthMm: 751 })).toMatchObject({ weightG: null, lengthMm: 751 });
    expect(parse({ weightG: 9320, lengthMm: 751, note: " consulta " })).toMatchObject({ note: "consulta" });
  });

  it("recusa medição vazia, valores fora da faixa e datas impossíveis", () => {
    expect(() => parse({})).toThrow("peso, o comprimento");
    expect(() => parse({ weightG: 299 })).toThrow("peso");
    expect(() => parse({ weightG: 40_001 })).toThrow("peso");
    expect(() => parse({ weightG: 9.3 })).toThrow("peso");
    expect(() => parse({ lengthMm: 249 })).toThrow("comprimento");
    expect(() => parse({ weightG: 9320, measuredOn: "2026-02-30" })).toThrow("Data");
    expect(() => parse({ weightG: 9320, measuredOn: "2026-11-23" })).toThrow("futuro");
    expect(() => parse({ weightG: 9320, childId: 0 })).toThrow("criança");
  });
});
