/**
 * Resumo para consultas: junta o que a família registrou num período e organiza por assunto.
 * Só agrupa e conta; não interpreta nada.
 */
import type { GrowthMeasurement } from "./growth";
import type { Milestone } from "./milestones";
import type { DoseHistoryItem, HealthEntry } from "./types";

export interface SummaryData {
  entries: HealthEntry[];
  doses: DoseHistoryItem[];
  /** Medições do período, mais a última de antes dele (para mostrar a variação). */
  growth: GrowthMeasurement[];
  milestones: Milestone[];
}

export interface MedicationSummary {
  medicationId: number;
  name: string;
  doseText: string;
  intervalMinutes: number;
  /** Doses previstas no período que já chegaram na hora. */
  total: number;
  given: number;
  /** Sem "Já dei". */
  notMarked: number;
  first: number;
  last: number;
  removed: boolean;
}

export interface GrowthChange {
  from: GrowthMeasurement;
  to: GrowthMeasurement;
  diff: number;
}

export interface Summary {
  temperatures: { at: number; value: number }[];
  maxTemperature?: { at: number; value: number };
  symptoms: { name: string; count: number; first: number; last: number }[];
  notes: { id: number; at: number; text: string }[];
  medications: MedicationSummary[];
  /** Medições dentro do período, da mais antiga para a mais recente. */
  measurements: GrowthMeasurement[];
  weightChange?: GrowthChange;
  lengthChange?: GrowthChange;
  milestones: Milestone[];
}

/** Variação entre a primeira e a última medição que têm o valor (a primeira pode ser de antes do período). */
function change(list: GrowthMeasurement[], pick: (m: GrowthMeasurement) => number | undefined): GrowthChange | undefined {
  const withValue = list.filter((m) => pick(m) !== undefined);
  if (withValue.length < 2) return undefined;
  const from = withValue[0];
  const to = withValue.at(-1)!;
  return { from, to, diff: pick(to)! - pick(from)! };
}

export function buildSummary(data: SummaryData, fromDate: string): Summary {
  const asc = [...data.entries].sort((a, b) => a.occurredAt - b.occurredAt);

  const temperatures = asc.flatMap((e) => (e.temperature === undefined ? [] : [{ at: e.occurredAt, value: e.temperature }]));
  const maxTemperature = temperatures.reduce<Summary["maxTemperature"]>(
    (max, t) => (!max || t.value > max.value ? t : max),
    undefined,
  );

  const symptomMap = new Map<string, { name: string; count: number; first: number; last: number }>();
  for (const e of asc) {
    for (const s of e.symptoms) {
      const key = s.toLowerCase();
      const cur = symptomMap.get(key);
      if (cur) {
        cur.count += 1;
        cur.last = e.occurredAt;
      } else symptomMap.set(key, { name: s, count: 1, first: e.occurredAt, last: e.occurredAt });
    }
  }
  const symptoms = [...symptomMap.values()].sort((a, b) => b.count - a.count || a.first - b.first);

  const notes = asc.filter((e) => e.note).map((e) => ({ id: e.id, at: e.occurredAt, text: e.note }));

  const meds = new Map<number, MedicationSummary>();
  for (const d of [...data.doses].sort((a, b) => a.scheduledAt - b.scheduledAt)) {
    const cur = meds.get(d.medicationId) ?? {
      medicationId: d.medicationId,
      name: d.medName,
      doseText: d.doseText,
      intervalMinutes: d.intervalMinutes,
      total: 0,
      given: 0,
      notMarked: 0,
      first: d.scheduledAt,
      last: d.scheduledAt,
      removed: d.medicationRemoved,
    };
    cur.total += 1;
    if (d.status === "given") cur.given += 1;
    else cur.notMarked += 1;
    cur.last = d.scheduledAt;
    // O nome, a dose e o intervalo mostrados são os da dose mais recente do período.
    cur.name = d.medName;
    cur.doseText = d.doseText;
    cur.intervalMinutes = d.intervalMinutes;
    meds.set(d.medicationId, cur);
  }
  const medications = [...meds.values()].sort((a, b) => a.first - b.first);

  const growthAsc = [...data.growth].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn) || a.id - b.id);
  const measurements = growthAsc.filter((m) => m.measuredOn >= fromDate);

  return {
    temperatures,
    maxTemperature,
    symptoms,
    notes,
    medications,
    measurements,
    weightChange: measurements.length ? change(growthAsc, (m) => m.weightG) : undefined,
    lengthChange: measurements.length ? change(growthAsc, (m) => m.lengthMm) : undefined,
    milestones: [...data.milestones].sort((a, b) => a.happenedOn.localeCompare(b.happenedOn)),
  };
}
