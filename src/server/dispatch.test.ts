import { describe, expect, it } from "vitest";
import { buildMessage, type DueDose } from "./dispatch";
import { nextTarget } from "./schedule";

const dose = (over: Partial<DueDose> = {}): DueDose => ({
  id: 7,
  familyId: "f",
  scheduledAt: Date.UTC(2026, 9, 22, 12, 0),
  notifiedCount: 0,
  childName: "Davi",
  medName: "Azitromicina 600mg",
  doseText: "2ml (oral)",
  ...over,
});

describe("buildMessage", () => {
  it("o primeiro aviso diz que é a hora de dar", () => {
    const m = buildMessage(dose(), dose().scheduledAt + 30_000);
    expect(m.title).toBe("Hora do remédio: Davi");
    expect(m.body).toBe("Azitromicina 600mg · 2ml (oral)");
    expect(m.tag).toBe("dose-7");
  });

  it("os repetidos dizem há quanto tempo está atrasado e mantêm a mesma tag", () => {
    const m = buildMessage(dose({ notifiedCount: 2 }), dose().scheduledAt + 22 * 60_000);
    expect(m.title).toBe("Atrasado: Davi");
    expect(m.body).toContain("faz 22 min");
    expect(m.tag).toBe("dose-7");
  });

  it("não inventa texto de dose quando a receita não tem", () => {
    const m = buildMessage(dose({ doseText: "" }), dose().scheduledAt);
    expect(m.body).toBe("Azitromicina 600mg");
  });
});

describe("nextTarget", () => {
  const now = Date.UTC(2026, 9, 22, 12, 0);

  it("não agenda nada quando não há dose a avisar", () => {
    expect(nextTarget(null, now)).toBeNull();
  });

  it("agenda na hora da dose quando ela está no futuro", () => {
    expect(nextTarget(now + 2 * 3_600_000, now)).toBe(now + 2 * 3_600_000);
  });

  it("dose já vencida vira uma chamada logo em seguida, nunca no passado", () => {
    expect(nextTarget(now - 60_000, now)).toBe(now + 5_000);
  });

  it("dose distante é limitada a 23h, para o vigia horário refazer a conta", () => {
    expect(nextTarget(now + 5 * 86_400_000, now)).toBe(now + 23 * 3_600_000);
  });
});
