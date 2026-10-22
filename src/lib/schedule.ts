/**
 * Motor de horários — funções puras, sem dependência de React, banco ou data atual.
 * Tudo trabalha em minutos para aceitar qualquer intervalo da receita (5 h, 7 h 30...).
 */

export const MIN_INTERVAL_MINUTES = 15;
export const MAX_INTERVAL_MINUTES = 72 * 60;
export const MAX_DAYS = 60;
const DAY = 1440;
/** Hora de dormir dos bebês: das 20h às 6h. */
export const SLEEP_START_MINUTE = 20 * 60;
export const SLEEP_END_MINUTE = 6 * 60;

/** Junta horas + minutos digitados e garante um intervalo válido (mínimo 15 min). */
export function toIntervalMinutes(hours: number, minutes: number): number {
  const h = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const total = h * 60 + Math.min(59, m);
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, total));
}

export function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 1;
  return Math.min(MAX_DAYS, Math.max(1, Math.floor(days)));
}

/** "8 h", "7 h 30 min", "45 min" */
export function formatInterval(intervalMinutes: number): string {
  const h = Math.floor(intervalMinutes / 60);
  const m = intervalMinutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/** Quantas doses cabem em `days` dias contando a partir da primeira dose. */
export function totalDoses(intervalMinutes: number, days: number): number {
  return Math.max(1, Math.floor((clampDays(days) * DAY) / intervalMinutes));
}

/** Instantes (epoch ms) de todas as doses do tratamento. */
export function generateDoseTimes(
  firstDoseAt: number,
  intervalMinutes: number,
  days: number,
): number[] {
  const total = totalDoses(intervalMinutes, days);
  const step = intervalMinutes * 60_000;
  return Array.from({ length: total }, (_, k) => firstDoseAt + k * step);
}

/** Hora de dormir: das 20h às 6h. */
export function isNightMinute(minuteOfDay: number): boolean {
  return minuteOfDay >= SLEEP_START_MINUTE || minuteOfDay < SLEEP_END_MINUTE;
}

/** Distância circular entre dois minutos do dia (00:10 e 23:50 ficam a 20 min). */
export function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % DAY;
  return Math.min(d, DAY - d);
}

export interface OtherDose {
  minuteOfDay: number;
  name: string;
}

export interface PreviewDose {
  /** Minuto do dia (0–1439) em que a dose cai. */
  minuteOfDay: number;
  /** 0 = no dia da primeira dose, 1 = no dia seguinte... */
  dayOffset: number;
  night: boolean;
  /** Nome do outro remédio que cai no mesmo horário (±tolerância), se houver. */
  conflictWith?: string;
}

/**
 * Prévia das primeiras 24 h para a timeline do cadastro.
 * `others` são os horários de remédios já cadastrados, usados para avisar coincidências.
 */
export function previewDay(
  startMinuteOfDay: number,
  intervalMinutes: number,
  others: OtherDose[] = [],
  toleranceMinutes = 30,
): PreviewDose[] {
  const start = ((Math.round(startMinuteOfDay) % DAY) + DAY) % DAY;
  const count = Math.max(1, Math.ceil(DAY / intervalMinutes));
  const result: PreviewDose[] = [];
  for (let k = 0; k < count; k++) {
    const abs = start + k * intervalMinutes;
    const minuteOfDay = abs % DAY;
    const hit = others.find(
      (o) => circularDistance(o.minuteOfDay, minuteOfDay) <= toleranceMinutes,
    );
    result.push({
      minuteOfDay,
      dayOffset: Math.floor(abs / DAY),
      night: isNightMinute(minuteOfDay),
      conflictWith: hit?.name,
    });
  }
  return result;
}

/** O intervalo divide 24 h exatamente? Se não, os horários mudam a cada dia. */
export function repeatsDaily(intervalMinutes: number): boolean {
  return DAY % intervalMinutes === 0;
}

export function formatClock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "08:30" -> 510. Devolve null se inválido. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
