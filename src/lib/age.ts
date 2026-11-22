/**
 * Idade cronológica e corrigida a partir de datas civis ("2025-03-14"), sem horário nem fuso:
 * a conta é feita no calendário, então o aniversário nunca "pula" um dia por causa do fuso.
 *
 * ⚠️ Os limites abaixo (semanas aceitas e até quando mostrar a idade corrigida) precisam ser
 * revisados com um profissional de saúde antes de liberar para outras famílias.
 */

/** Gestação a termo de referência para a idade corrigida: 40 semanas. */
export const TERM_DAYS = 40 * 7;
/** Prematuro é quem nasce antes de 37 semanas. */
export const PRETERM_WEEKS_LIMIT = 37;
/** Menor idade gestacional aceita no cadastro. */
export const MIN_GA_WEEKS = 22;
/** Até que idade cronológica a idade corrigida é mostrada (uso comum: até os 2 anos). */
export const CORRECTED_AGE_UNTIL_MONTHS = 24;

export interface CivilDate {
  y: number;
  m: number; // 1–12
  d: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Lê "AAAA-MM-DD" e confere se a data existe (nada de 31/02). */
export function parseCivilDate(value: string): CivilDate | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

export const toIso = ({ y, m, d }: CivilDate): string =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** A data de hoje no calendário do aparelho. */
export function todayCivil(now = Date.now()): CivilDate {
  const date = new Date(now);
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

const dayNumber = ({ y, m, d }: CivilDate) => Date.UTC(y, m - 1, d) / 86_400_000;

function fromDayNumber(n: number): CivilDate {
  const date = new Date(n * 86_400_000);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

export const addDays = (date: CivilDate, days: number): CivilDate => fromDayNumber(dayNumber(date) + days);

export const daysBetween = (from: CivilDate, to: CivilDate): number => dayNumber(to) - dayNumber(from);

/** Soma meses mantendo o dia, ou o último dia do mês quando ele não existe (31/01 + 1 mês = 28/02). */
function addMonths({ y, m, d }: CivilDate, months: number): CivilDate {
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return { y: ny, m: nm, d: Math.min(d, lastDay) };
}

export interface Age {
  /** Meses completos. */
  months: number;
  /** Dias depois do último "mêsversário". */
  days: number;
  /** Total de dias de vida (negativo: a data ainda não chegou). */
  totalDays: number;
}

/** Diferença de calendário entre duas datas, em meses completos e dias. */
export function ageBetween(from: CivilDate, to: CivilDate): Age {
  const totalDays = daysBetween(from, to);
  if (totalDays < 0) return { months: 0, days: 0, totalDays };
  let months = (to.y - from.y) * 12 + (to.m - from.m);
  if (daysBetween(addMonths(from, months), to) < 0) months -= 1;
  return { months, days: daysBetween(addMonths(from, months), to), totalDays };
}

export interface GestationalAge {
  weeks: number;
  days: number;
}

export interface ChildAges {
  chronological: Age;
  /** Só quando há prematuridade com idade gestacional informada e dentro do período de uso. */
  corrected?: Age;
  /** A idade corrigida ainda não começou: faltam tantos dias para a data prevista do parto (40 semanas). */
  daysUntilTerm?: number;
}

/**
 * Idade corrigida = idade cronológica menos as semanas que faltaram para 40.
 * Na prática, é a idade contada a partir da data em que o bebê completaria 40 semanas de gestação.
 */
export function childAges(
  birth: CivilDate,
  today: CivilDate,
  premature: boolean,
  ga?: GestationalAge,
): ChildAges {
  const chronological = ageBetween(birth, today);
  if (!premature || !ga || chronological.months >= CORRECTED_AGE_UNTIL_MONTHS) return { chronological };
  const missing = TERM_DAYS - (ga.weeks * 7 + ga.days);
  if (missing <= 0) return { chronological };
  const term = addDays(birth, missing);
  const untilTerm = daysBetween(today, term);
  if (untilTerm > 0) return { chronological, daysUntilTerm: untilTerm };
  return { chronological, corrected: ageBetween(term, today) };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "12 dias", "3 meses e 5 dias", "1 ano e 2 meses", "3 anos".
 * Até 1 mês conta em dias; até 2 anos, meses e dias; depois, anos e meses.
 */
export function formatAge(age: Age): string {
  if (age.months === 0) return plural(age.days, "dia", "dias");
  if (age.months < 24) {
    const months = plural(age.months, "mês", "meses");
    return age.days ? `${months} e ${plural(age.days, "dia", "dias")}` : months;
  }
  const years = Math.floor(age.months / 12);
  const rest = age.months % 12;
  const yearsText = plural(years, "ano", "anos");
  return rest ? `${yearsText} e ${plural(rest, "mês", "meses")}` : yearsText;
}

/** "faltam 3 semanas e 2 dias" para a data prevista do parto. */
export function formatUntilTerm(days: number): string {
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  if (!weeks) return plural(rest, "dia", "dias");
  return rest ? `${plural(weeks, "semana", "semanas")} e ${plural(rest, "dia", "dias")}` : plural(weeks, "semana", "semanas");
}
