import { describe, expect, it } from "vitest";
import { buildMessage, type DueDose } from "./dispatch";

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
