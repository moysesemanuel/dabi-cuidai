import { describe, expect, it } from "vitest";
import type { GrowthMeasurement } from "./growth";
import { buildSummary } from "./summary";
import type { DoseHistoryItem, HealthEntry } from "./types";

const H = 3_600_000;
const t0 = Date.UTC(2026, 10, 10, 12);
const entry = (id: number, at: number, e: Partial<HealthEntry>): HealthEntry => ({
  id,
  childId: 1,
  occurredAt: at,
  symptoms: [],
  note: "",
  createdAt: at,
  updatedAt: at,
  ...e,
});
const dose = (id: number, medicationId: number, at: number, status: "given" | "pending", d: Partial<DoseHistoryItem> = {}): DoseHistoryItem => ({
  id,
  childId: 1,
  medicationId,
  medName: "Amoxicilina",
  doseText: "5 ml",
  intervalMinutes: 480,
  scheduledAt: at,
  status,
  medicationRemoved: false,
  ...d,
});
const measure = (id: number, measuredOn: string, weightG?: number, lengthMm?: number): GrowthMeasurement => ({
  id,
  childId: 1,
  measuredOn,
  weightG,
  lengthMm,
  note: "",
});

describe("buildSummary", () => {
  const data = {
    entries: [
      entry(3, t0 + 30 * H, { temperature: 37.6, symptoms: ["tosse"], note: "melhorou" }),
      entry(1, t0, { temperature: 38.4, symptoms: ["Tosse", "Coriza"] }),
      entry(2, t0 + 10 * H, { temperature: 38.4, symptoms: ["Coriza", "Tosse"], note: "mais quietinha" }),
    ],
    doses: [
      dose(10, 5, t0, "given"),
      dose(11, 5, t0 + 8 * H, "pending"),
      dose(12, 5, t0 + 16 * H, "given", { medName: "Amoxil", doseText: "7 ml", intervalMinutes: 360 }),
      dose(20, 6, t0 - 5 * H, "given", { medName: "Dipirona", doseText: "10 gotas", medicationRemoved: true }),
    ],
    growth: [measure(2, "2026-11-12", 9050, 734), measure(1, "2026-09-15", 8600, 710), measure(3, "2026-11-20", undefined, 736)],
    milestones: [],
  };
  const s = buildSummary(data, "2026-11-01");

  it("temperaturas em ordem, com a maior (a primeira, em caso de empate)", () => {
    expect(s.temperatures.map((t) => t.value)).toEqual([38.4, 38.4, 37.6]);
    expect(s.maxTemperature).toEqual({ at: t0, value: 38.4 });
  });

  it("sintomas contados sem diferenciar maiúsculas, do mais frequente", () => {
    expect(s.symptoms.map((x) => [x.name, x.count])).toEqual([
      ["Tosse", 3],
      ["Coriza", 2],
    ]);
    expect(s.symptoms[0]).toMatchObject({ first: t0, last: t0 + 30 * H });
  });

  it("anotações na ordem em que aconteceram", () => {
    expect(s.notes.map((n) => n.text)).toEqual(["mais quietinha", "melhorou"]);
  });

  it("remédios: doses dadas e sem \"Já dei\", com o nome mais recente", () => {
    expect(s.medications).toEqual([
      expect.objectContaining({ medicationId: 6, name: "Dipirona", total: 1, given: 1, notMarked: 0, removed: true }),
      expect.objectContaining({ medicationId: 5, name: "Amoxil", doseText: "7 ml", intervalMinutes: 360, total: 3, given: 2, notMarked: 1, first: t0, last: t0 + 16 * H }),
    ]);
  });

  it("crescimento: só medições do período, com a variação desde a anterior ao período", () => {
    expect(s.measurements.map((m) => m.id)).toEqual([2, 3]);
    expect(s.weightChange).toMatchObject({ diff: 450 });
    expect(s.weightChange?.from.id).toBe(1);
    expect(s.lengthChange).toMatchObject({ diff: 26 });
  });

  it("sem medição no período, não mostra variação", () => {
    const empty = buildSummary({ ...data, growth: [measure(1, "2026-09-15", 8600)] }, "2026-11-01");
    expect(empty.measurements).toEqual([]);
    expect(empty.weightChange).toBeUndefined();
  });
});
