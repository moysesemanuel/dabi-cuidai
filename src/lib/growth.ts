/**
 * Crescimento: leitura dos campos, formatação e escalas do gráfico.
 * Peso em gramas e comprimento em milímetros (inteiros), como no banco.
 */

export const MIN_WEIGHT_G = 300;
export const MAX_WEIGHT_G = 40_000;
export const MIN_LENGTH_MM = 250;
export const MAX_LENGTH_MM = 1_500;

export interface GrowthMeasurement {
  id: number;
  childId: number;
  /** Data civil "AAAA-MM-DD". */
  measuredOn: string;
  weightG?: number;
  lengthMm?: number;
  note: string;
}

export interface GrowthInput {
  childId: number;
  measuredOn: string;
  weightG: number | null;
  lengthMm: number | null;
  note: string;
}

export type GrowthMetric = "weight" | "length";

/** "9,32" ou "9.32" kg → 9320 g. Vazio ou inválido: null. */
export function parseKg(value: string): number | null {
  const clean = value.trim().replace(",", ".").replace(/\s*kg$/i, "");
  if (!/^\d{1,2}(\.\d{1,3})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 1000);
}

/** "75,1" ou "75.1" cm → 751 mm. Vazio ou inválido: null. */
export function parseCm(value: string): number | null {
  const clean = value.trim().replace(",", ".").replace(/\s*cm$/i, "");
  if (!/^\d{2,3}(\.\d)?$/.test(clean)) return null;
  return Math.round(Number(clean) * 10);
}

const num = (n: number, decimals: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** 9320 → "9,32 kg"; 75 1 → "75,1 cm". */
export const fmtWeight = (g: number) => `${num(g / 1000, 2)} kg`;
export const fmtLength = (mm: number) => `${num(mm / 10, 1)} cm`;
/** Valor do campo de edição: 9320 → "9,32"; 751 → "75,1". */
export const kgInput = (g: number) => num(g / 1000, g % 10 ? 3 : 2);
export const cmInput = (mm: number) => num(mm / 10, 1);

/** Diferença entre duas medições: "+420 g", "−50 g", "+2,2 cm". */
export function fmtChange(metric: GrowthMetric, diff: number): string {
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const abs = Math.abs(diff);
  return metric === "weight" ? `${sign}${abs.toLocaleString("pt-BR")} g` : `${sign}${num(abs / 10, 1)} cm`;
}

/** Passo "redondo" (1, 2, 2,5, 5 × 10ⁿ) para dividir `span` em cerca de `target` partes. */
export function niceStep(span: number, target: number): number {
  if (!(span > 0)) return 1;
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

/** Marcas do eixo de `min` a `max`, alinhadas a um passo redondo. */
export function ticks(min: number, max: number, target: number): { from: number; to: number; step: number; values: number[] } {
  const span = max - min || Math.abs(max) || 1;
  const step = niceStep(span, target);
  const from = Math.floor(min / step) * step;
  let to = Math.ceil(max / step) * step;
  if (to === from) to = from + step;
  const values: number[] = [];
  for (let v = from; v <= to + step / 1000; v += step) values.push(Math.round(v * 1e6) / 1e6);
  return { from, to, step, values };
}
