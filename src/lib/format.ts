export const fmtTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const fmtDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export const fmtLongDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function fmtDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** Texto curto de situação da dose: "atrasada 25 min", "em 40 min" ou "às 14:00". */
export function relativeLabel(scheduledAt: number, now: number): { text: string; late: boolean } {
  const diffMin = (scheduledAt - now) / 60_000;
  if (diffMin < -1) return { text: `atrasada ${fmtDuration(-diffMin)}`, late: true };
  if (diffMin <= 60) return { text: diffMin < 1 ? "agora" : `em ${fmtDuration(diffMin)}`, late: false };
  return { text: `às ${fmtTime(scheduledAt)}`, late: false };
}
