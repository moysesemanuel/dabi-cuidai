import { ageBetween, childAges, formatAge, parseCivilDate, type CivilDate, type GestationalAge } from "./age";

export type DatePrecision = "day" | "month" | "about";
export type MilestoneCategory = "movement" | "communication" | "interaction" | "other";

export const CATEGORIES: { value: MilestoneCategory; label: string }[] = [
  { value: "movement", label: "Movimento" },
  { value: "communication", label: "Comunicação" },
  { value: "interaction", label: "Interação" },
  { value: "other", label: "Outro" },
];

/** Atalhos para o título. Não têm idade associada: são só para não precisar digitar. */
export const TITLE_SUGGESTIONS = [
  "Primeiro sorriso",
  "Sustentou a cabeça",
  "Rolou sozinho(a)",
  "Sentou sem apoio",
  "Engatinhou",
  "Ficou em pé com apoio",
  "Primeiros passos",
  "Primeira palavra",
  "Bateu palmas",
  "Primeiro dente",
] as const;

export interface Milestone {
  id: number;
  childId: number;
  title: string;
  /** "AAAA-MM-DD"; com precisão de mês, sempre o dia 1º. */
  happenedOn: string;
  precision: DatePrecision;
  category?: MilestoneCategory;
  note: string;
}

export interface MilestoneInput {
  childId: number;
  title: string;
  happenedOn: string;
  precision: DatePrecision;
  category: MilestoneCategory | null;
  note: string;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "12/03/2026", "março de 2026" ou "por volta de março de 2026". */
export function fmtMilestoneDate(happenedOn: string, precision: DatePrecision): string {
  const d = parseCivilDate(happenedOn);
  if (!d) return happenedOn;
  if (precision === "day") return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
  const month = `${MONTHS[d.m - 1]} de ${d.y}`;
  return precision === "about" ? `por volta de ${month}` : month;
}

/**
 * Idade da criança no marco: "com 9 meses e 3 dias", ou só os meses quando a data é do mês ("com cerca de 9 meses").
 * Para prematuros com idade gestacional, acrescenta a corrigida, sempre identificada como tal.
 */
export function milestoneAge(
  happenedOn: string,
  precision: DatePrecision,
  birth: CivilDate | null,
  premature: boolean,
  ga?: GestationalAge,
): string | null {
  const date = parseCivilDate(happenedOn);
  if (!birth || !date) return null;
  // Com só o mês, usa o meio do mês para a conta e mostra só meses completos.
  const at = precision === "day" ? date : { ...date, d: 15 };
  const ages = childAges(birth, at, premature, ga);
  if (ages.chronological.totalDays < 0) return null;
  const text = (age: ReturnType<typeof ageBetween>) =>
    precision === "day" ? formatAge(age) : formatAge({ ...age, days: 0, months: Math.max(age.months, 0) });
  const prefix = precision === "day" ? "com " : "com cerca de ";
  const chrono =
    precision !== "day" && ages.chronological.months === 0 ? "com menos de 1 mês" : prefix + text(ages.chronological);
  if (ages.corrected && !(precision !== "day" && ages.corrected.months === 0)) {
    return `${chrono} (${text(ages.corrected)} de idade corrigida)`;
  }
  return chrono;
}
