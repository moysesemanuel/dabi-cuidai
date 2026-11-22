export const fmtTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const fmtDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export const fmtLongDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

/** Saudação pela hora do aparelho: bom dia das 5h ao meio-dia, boa tarde até as 18h, boa noite depois. */
export function greeting(ms: number, name?: string): string {
  const hour = new Date(ms).getHours();
  const base = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${base}, ${first}!` : `${base}!`;
}

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

/** "Hoje", "Ontem" ou "sexta, 14 de novembro" (com o ano quando não é o atual). */
export function fmtDayLabel(ms: number, now: number): string {
  const day = startOfDay(ms);
  const today = startOfDay(now);
  if (day === today) return "Hoje";
  if (day === startOfDay(today - 12 * 3_600_000)) return "Ontem";
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return new Date(ms).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "38,0 °C". */
export const fmtTemperature = (celsius: number): string =>
  `${celsius.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`;

/** Lê o que foi digitado no campo de temperatura ("37,8", "37.8", "38"). Vazio ou inválido: null. */
export function parseTemperatureInput(value: string): number | null {
  const clean = value.trim().replace(",", ".").replace(/\s*°?\s*c?$/i, "");
  if (!/^\d{2}(\.\d+)?$/.test(clean)) return null;
  return Math.round(Number(clean) * 10) / 10;
}
