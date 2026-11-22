import { describe, expect, it } from "vitest";
import { parseHealthEntry } from "./diary";

const now = 1_800_000_000_000;
const parse = (body: Record<string, unknown>) => parseHealthEntry({ childId: 1, occurredAt: now - 60_000, ...body }, now);

describe("parseHealthEntry", () => {
  it("aceita só temperatura, só sintoma ou só anotação", () => {
    expect(parse({ temperature: 38 })).toMatchObject({ temperature: 38, symptoms: [], note: "" });
    expect(parse({ symptoms: ["Tosse"] })).toMatchObject({ temperature: null, symptoms: ["Tosse"] });
    expect(parse({ note: "  estava mais quietinha " })).toMatchObject({ note: "estava mais quietinha" });
  });

  it("arredonda a temperatura para uma casa decimal", () => {
    expect(parse({ temperature: 37.84 }).temperature).toBe(37.8);
    expect(parse({ temperature: 37.85 }).temperature).toBe(37.9);
  });

  it("limpa e tira sintomas repetidos", () => {
    expect(parse({ symptoms: [" Tosse ", "tosse", "Dor  de ouvido", ""] }).symptoms).toEqual(["Tosse", "Dor de ouvido"]);
  });

  it("recusa registro vazio e valores impossíveis", () => {
    expect(() => parse({})).toThrow("temperatura, um sintoma ou uma anotação");
    expect(() => parse({ symptoms: [" "], note: " " })).toThrow("temperatura, um sintoma ou uma anotação");
    expect(() => parse({ temperature: 33.9 })).toThrow("entre 34 e 43");
    expect(() => parse({ temperature: 43.1 })).toThrow("entre 34 e 43");
    expect(() => parse({ temperature: "38" })).toThrow("Temperatura inválida");
    expect(() => parse({ note: "x".repeat(1001) })).toThrow("muito longa");
    expect(() => parse({ symptoms: ["x".repeat(41)] })).toThrow("muito longo");
    expect(() => parse({ childId: undefined, note: "a" })).toThrow("criança");
  });

  it("aceita até 1 hora no futuro (relógio adiantado) e recusa mais que isso", () => {
    expect(() => parse({ occurredAt: now + 59 * 60_000, note: "a" })).not.toThrow();
    expect(() => parse({ occurredAt: now + 61 * 60_000, note: "a" })).toThrow("futuro");
    expect(() => parse({ occurredAt: now - 401 * 86_400_000, note: "a" })).toThrow("antiga demais");
  });
});
