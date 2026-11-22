import { describe, expect, it } from "vitest";
import { ageBetween, childAges, formatAge, formatUntilTerm, parseCivilDate, type CivilDate } from "./age";

const d = (iso: string): CivilDate => parseCivilDate(iso)!;

describe("parseCivilDate", () => {
  it("aceita só datas que existem", () => {
    expect(parseCivilDate("2024-02-29")).toEqual({ y: 2024, m: 2, d: 29 });
    expect(parseCivilDate("2025-02-29")).toBeNull();
    expect(parseCivilDate("2025-02-30")).toBeNull();
    expect(parseCivilDate("2025-13-01")).toBeNull();
    expect(parseCivilDate("21/11/2025")).toBeNull();
    expect(parseCivilDate("2025-1-5")).toBeNull();
  });
});

describe("ageBetween (idade cronológica)", () => {
  it("conta meses completos e os dias que sobram", () => {
    expect(ageBetween(d("2025-03-14"), d("2025-11-21"))).toMatchObject({ months: 8, days: 7 });
    expect(ageBetween(d("2025-11-21"), d("2025-11-21"))).toMatchObject({ months: 0, days: 0, totalDays: 0 });
    expect(ageBetween(d("2025-11-01"), d("2025-11-21"))).toMatchObject({ months: 0, days: 20 });
  });

  it("trata fim de mês e 29 de fevereiro", () => {
    expect(ageBetween(d("2025-01-31"), d("2025-02-28"))).toMatchObject({ months: 1, days: 0 });
    expect(ageBetween(d("2025-01-31"), d("2025-02-27"))).toMatchObject({ months: 0, days: 27 });
    expect(ageBetween(d("2024-02-29"), d("2025-02-28"))).toMatchObject({ months: 12, days: 0 });
    expect(ageBetween(d("2024-02-29"), d("2025-03-01"))).toMatchObject({ months: 12, days: 1 });
  });

  it("passa a virada do ano", () => {
    expect(ageBetween(d("2024-12-20"), d("2026-01-05"))).toMatchObject({ months: 12, days: 16 });
  });
});

describe("childAges (idade corrigida)", () => {
  const today = d("2025-11-21");

  it("prematuro de 32 semanas: desconta as 8 semanas que faltaram para 40", () => {
    const ages = childAges(d("2025-06-01"), today, true, { weeks: 32, days: 0 });
    expect(ages.chronological).toMatchObject({ months: 5, days: 20 });
    // Completaria 40 semanas em 27/07/2025 → 3 meses e 25 dias depois.
    expect(ages.corrected).toMatchObject({ months: 3, days: 25 });
  });

  it("considera os dias da idade gestacional", () => {
    // 34s5d: faltaram 37 dias (5s2d). Nasceu em 01/09 → 40 semanas em 08/10.
    const ages = childAges(d("2025-09-01"), today, true, { weeks: 34, days: 5 });
    expect(ages.corrected).toMatchObject({ months: 1, days: 13 });
  });

  it("antes da data prevista do parto, diz quanto falta em vez de uma idade negativa", () => {
    const ages = childAges(d("2025-11-01"), today, true, { weeks: 30, days: 0 });
    expect(ages.corrected).toBeUndefined();
    expect(ages.daysUntilTerm).toBe(50);
    expect(formatUntilTerm(50)).toBe("7 semanas e 1 dia");
  });

  it("no dia em que completaria 40 semanas, a idade corrigida é zero", () => {
    const ages = childAges(d("2025-10-24"), today, true, { weeks: 36, days: 0 });
    expect(ages.corrected).toMatchObject({ months: 0, days: 0, totalDays: 0 });
  });

  it("sem prematuridade, sem idade gestacional ou depois dos 2 anos, mostra só a cronológica", () => {
    expect(childAges(d("2025-06-01"), today, false, { weeks: 32, days: 0 }).corrected).toBeUndefined();
    expect(childAges(d("2025-06-01"), today, true).corrected).toBeUndefined();
    expect(childAges(d("2023-11-21"), today, true, { weeks: 30, days: 0 }).corrected).toBeUndefined();
    expect(childAges(d("2023-11-22"), today, true, { weeks: 30, days: 0 }).corrected).toBeDefined();
  });

  it("33 semanas e 2 dias: faltaram 47 dias, 40 semanas em 18/07", () => {
    const ages = childAges(d("2025-06-01"), today, true, { weeks: 33, days: 2 });
    expect(ages.corrected).toMatchObject({ months: 4, days: 3 });
  });
});

describe("formatAge", () => {
  it("usa dias, depois meses e dias, depois anos e meses", () => {
    expect(formatAge({ months: 0, days: 1, totalDays: 1 })).toBe("1 dia");
    expect(formatAge({ months: 0, days: 12, totalDays: 12 })).toBe("12 dias");
    expect(formatAge({ months: 1, days: 0, totalDays: 30 })).toBe("1 mês");
    expect(formatAge({ months: 3, days: 5, totalDays: 97 })).toBe("3 meses e 5 dias");
    expect(formatAge({ months: 23, days: 1, totalDays: 700 })).toBe("23 meses e 1 dia");
    expect(formatAge({ months: 24, days: 9, totalDays: 740 })).toBe("2 anos");
    expect(formatAge({ months: 26, days: 0, totalDays: 790 })).toBe("2 anos e 2 meses");
    expect(formatAge({ months: 37, days: 3, totalDays: 1130 })).toBe("3 anos e 1 mês");
  });
});
