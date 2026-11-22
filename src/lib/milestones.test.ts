import { describe, expect, it } from "vitest";
import { parseCivilDate } from "./age";
import { fmtMilestoneDate, milestoneAge } from "./milestones";

const birth = parseCivilDate("2025-08-30")!;

describe("fmtMilestoneDate", () => {
  it("mostra a data conforme a precisão", () => {
    expect(fmtMilestoneDate("2026-03-12", "day")).toBe("12/03/2026");
    expect(fmtMilestoneDate("2026-03-01", "month")).toBe("março de 2026");
    expect(fmtMilestoneDate("2026-03-01", "about")).toBe("por volta de março de 2026");
  });
});

describe("milestoneAge", () => {
  it("data exata: meses e dias", () => {
    expect(milestoneAge("2026-06-02", "day", birth, false)).toBe("com 9 meses e 3 dias");
  });

  it("só o mês: cerca de N meses, sem dias", () => {
    expect(milestoneAge("2026-06-01", "month", birth, false)).toBe("com cerca de 9 meses");
    expect(milestoneAge("2026-06-01", "about", birth, false)).toBe("com cerca de 9 meses");
    expect(milestoneAge("2025-09-01", "month", birth, false)).toBe("com menos de 1 mês");
  });

  it("prematuro com idade gestacional: acrescenta a corrigida, identificada", () => {
    // 35 semanas: faltaram 35 dias; 40 semanas em 04/10/2025.
    expect(milestoneAge("2026-06-02", "day", birth, true, { weeks: 35, days: 0 })).toBe(
      "com 9 meses e 3 dias (7 meses e 29 dias de idade corrigida)",
    );
  });

  it("sem data de nascimento ou antes dela, não mostra idade", () => {
    expect(milestoneAge("2026-06-02", "day", null, false)).toBeNull();
    expect(milestoneAge("2025-08-01", "day", birth, false)).toBeNull();
  });
});
