import { describe, expect, it } from "vitest";
import { parseMilestoneInput } from "./milestones";

const today = { y: 2026, m: 11, d: 21 };
const parse = (body: Record<string, unknown>) =>
  parseMilestoneInput({ childId: 1, title: "Primeiros passos", happenedOn: "2026-10-12", precision: "day", ...body }, today);

describe("parseMilestoneInput", () => {
  it("guarda a data exata ou o dia 1º quando é só o mês", () => {
    expect(parse({})).toMatchObject({ happenedOn: "2026-10-12", precision: "day", category: null, note: "" });
    expect(parse({ precision: "month" })).toMatchObject({ happenedOn: "2026-10-01" });
    expect(parse({ precision: "about", category: "movement" })).toMatchObject({ happenedOn: "2026-10-01", category: "movement" });
  });

  it("aceita o mês atual mesmo com só o mês e limpa espaços do título", () => {
    expect(parse({ happenedOn: "2026-11-30", precision: "month", title: "  Bateu   palmas " })).toMatchObject({
      happenedOn: "2026-11-01",
      title: "Bateu palmas",
    });
  });

  it("recusa título vazio, data futura e valores desconhecidos", () => {
    expect(() => parse({ title: "  " })).toThrow("Escreva");
    expect(() => parse({ title: "x".repeat(121) })).toThrow("longo");
    expect(() => parse({ happenedOn: "2026-11-23" })).toThrow("futuro");
    expect(() => parse({ happenedOn: "2026-12-01", precision: "month" })).toThrow("futuro");
    expect(() => parse({ precision: "year" })).toThrow("Precisão");
    expect(() => parse({ category: "motor" })).toThrow("Categoria");
    expect(() => parse({ happenedOn: "2026-02-30" })).toThrow("Data inválida");
  });
});
