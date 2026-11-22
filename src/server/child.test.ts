import { describe, expect, it } from "vitest";
import { mergeChildPatch } from "./repo";

type Columns = Parameters<typeof mergeChildPatch>[0];

const today = { y: 2025, m: 11, d: 21 };
const base: Columns = { name: "Bianca", fill: "#FFAFA3", birth_date: null, premature: null, ga_weeks: null, ga_days: null };
const merge = (body: Record<string, unknown>, current: Columns = base) => mergeChildPatch({ ...current }, body, today);

describe("mergeChildPatch", () => {
  it("só muda o que veio no corpo", () => {
    expect(merge({ birthDate: "2025-06-01" })).toEqual({ ...base, birth_date: "2025-06-01" });
    expect(merge({ name: " Bia " })).toEqual({ ...base, name: "Bia" });
  });

  it("guarda prematuridade e idade gestacional juntas", () => {
    expect(merge({ premature: "yes", gestationalAge: { weeks: 32, days: 4 } })).toMatchObject({
      premature: "yes",
      ga_weeks: 32,
      ga_days: 4,
    });
  });

  it("deixar de ser prematuro (ou não informar) apaga a idade gestacional", () => {
    const preterm: Columns = { ...base, premature: "yes", ga_weeks: 32, ga_days: 4 };
    expect(merge({ premature: "no" }, preterm)).toMatchObject({ premature: "no", ga_weeks: null, ga_days: null });
    expect(merge({ premature: null }, preterm)).toMatchObject({ premature: null, ga_weeks: null, ga_days: null });
    expect(merge({ gestationalAge: null }, preterm)).toMatchObject({ premature: "yes", ga_weeks: null });
  });

  it("copia o nascimento de um gêmeo de uma vez, em qualquer ordem de campos", () => {
    expect(merge({ gestationalAge: { weeks: 33, days: 2 }, premature: "yes", birthDate: "2025-06-01" })).toMatchObject({
      birth_date: "2025-06-01",
      premature: "yes",
      ga_weeks: 33,
      ga_days: 2,
    });
  });

  it("aceita prematuro sem idade gestacional (ela é opcional)", () => {
    expect(merge({ premature: "yes" })).toMatchObject({ premature: "yes", ga_weeks: null });
  });

  it("apaga a data com null", () => {
    expect(merge({ birthDate: null }, { ...base, birth_date: "2025-06-01" })).toMatchObject({ birth_date: null });
  });

  it("recusa dados impossíveis", () => {
    expect(() => merge({ birthDate: "2025-02-30" })).toThrow("Data de nascimento inválida");
    expect(() => merge({ birthDate: "2025-11-24" })).toThrow("futuro");
    expect(() => merge({ birthDate: "2001-01-01" })).toThrow("antiga demais");
    expect(() => merge({ premature: "talvez" })).toThrow("prematuro inválido");
    expect(() => merge({ premature: "yes", gestationalAge: { weeks: 37, days: 0 } })).toThrow("Semanas");
    expect(() => merge({ premature: "yes", gestationalAge: { weeks: 21, days: 6 } })).toThrow("Semanas");
    expect(() => merge({ premature: "yes", gestationalAge: { weeks: 30, days: 7 } })).toThrow("Dias");
    expect(() => merge({ gestationalAge: { weeks: 32, days: 0 } })).toThrow("só para quem nasceu prematuro");
  });

  it("aceita amanhã (fuso do aparelho à frente do servidor)", () => {
    expect(merge({ birthDate: "2025-11-22" })).toMatchObject({ birth_date: "2025-11-22" });
  });
});
