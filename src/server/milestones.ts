import { daysBetween, parseCivilDate, toIso, todayCivil, type CivilDate } from "@/lib/age";
import { CATEGORIES, type DatePrecision, type Milestone, type MilestoneCategory, type MilestoneInput } from "@/lib/milestones";
import type { Session } from "./auth";
import { HttpError } from "./http";
import { sql } from "./sql";

const MAX_TITLE = 120;
const MAX_NOTE = 500;
const PRECISIONS: DatePrecision[] = ["day", "month", "about"];

/** Confere um marco. Com precisão de mês, guarda o dia 1º; a data não pode ser futura. */
export function parseMilestoneInput(body: Record<string, unknown>, today: CivilDate = todayCivil()): MilestoneInput {
  const childId = body.childId;
  if (typeof childId !== "number" || !Number.isSafeInteger(childId) || childId < 1) throw new HttpError(400, "Escolha a criança.");
  const title = typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new HttpError(400, "Escreva o que aconteceu.");
  if (title.length > MAX_TITLE) throw new HttpError(400, "Título muito longo.");

  const precision = body.precision as DatePrecision;
  if (!PRECISIONS.includes(precision)) throw new HttpError(400, "Precisão da data inválida.");
  const parsed = typeof body.happenedOn === "string" ? parseCivilDate(body.happenedOn) : null;
  if (!parsed) throw new HttpError(400, "Data inválida.");
  const date = precision === "day" ? parsed : { ...parsed, d: 1 };
  // Um dia de folga: o servidor pode já estar no dia seguinte ao do aparelho.
  if (daysBetween(today, date) > 1) throw new HttpError(400, "A data não pode ser no futuro.");

  let category: MilestoneCategory | null = null;
  if (body.category !== undefined && body.category !== null) {
    if (!CATEGORIES.some((c) => c.value === body.category)) throw new HttpError(400, "Categoria inválida.");
    category = body.category as MilestoneCategory;
  }
  const note = typeof body.note === "string" ? body.note.trim() : body.note == null ? "" : null;
  if (note === null || note.length > MAX_NOTE) throw new HttpError(400, "Observação inválida ou muito longa.");
  return { childId, title, happenedOn: toIso(date), precision, category, note };
}

interface Row {
  id: number;
  child_id: number;
  title: string;
  happened_on: string;
  date_precision: DatePrecision;
  category: MilestoneCategory | null;
  note: string;
}

const toMilestone = (r: Row): Milestone => ({
  id: r.id,
  childId: r.child_id,
  title: r.title,
  happenedOn: r.happened_on,
  precision: r.date_precision,
  category: r.category ?? undefined,
  note: r.note,
});

const COLUMNS = sql`id, child_id, title, happened_on::text as happened_on, date_precision, category, note`;

/** Confere que a criança é da família e que o marco não é de antes do nascimento (no mesmo mês, aceita). */
async function assertChild(session: Session, input: MilestoneInput): Promise<void> {
  const [child] = await sql<{ birth_date: string | null }[]>`
    select birth_date::text as birth_date from children where id = ${input.childId} and family_id = ${session.familyId}`;
  if (!child) throw new HttpError(404, "Criança não encontrada.");
  const floor = child.birth_date && (input.precision === "day" ? child.birth_date : `${child.birth_date.slice(0, 7)}-01`);
  if (floor && input.happenedOn < floor) throw new HttpError(400, "A data é anterior ao nascimento.");
}

/** Marcos de uma criança, do mais recente para o mais antigo. */
export async function listMilestones(session: Session, childId: number): Promise<Milestone[]> {
  const kid = await sql`select 1 from children where id = ${childId} and family_id = ${session.familyId}`;
  if (!kid.length) throw new HttpError(404, "Criança não encontrada.");
  const rows = await sql<Row[]>`
    select ${COLUMNS} from milestones
    where family_id = ${session.familyId} and child_id = ${childId}
    order by happened_on desc, id desc`;
  return rows.map(toMilestone);
}

export async function getMilestone(session: Session, id: number): Promise<Milestone> {
  const [row] = await sql<Row[]>`select ${COLUMNS} from milestones where id = ${id} and family_id = ${session.familyId}`;
  if (!row) throw new HttpError(404, "Marco não encontrado.");
  return toMilestone(row);
}

export async function createMilestone(session: Session, input: MilestoneInput, now = Date.now()): Promise<number> {
  await assertChild(session, input);
  const [row] = await sql<{ id: number }[]>`
    insert into milestones (family_id, child_id, title, happened_on, date_precision, category, note, created_by, created_at, updated_at)
    values (${session.familyId}, ${input.childId}, ${input.title}, ${input.happenedOn}::date, ${input.precision},
            ${input.category}, ${input.note}, ${session.deviceId}, ${now}, ${now})
    returning id`;
  return row.id;
}

export async function updateMilestone(session: Session, id: number, input: MilestoneInput, now = Date.now()): Promise<void> {
  await assertChild(session, input);
  const rows = await sql`
    update milestones set child_id = ${input.childId}, title = ${input.title}, happened_on = ${input.happenedOn}::date,
      date_precision = ${input.precision}, category = ${input.category}, note = ${input.note}, updated_at = ${now}
    where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Marco não encontrado.");
}

export async function deleteMilestone(session: Session, id: number): Promise<void> {
  const rows = await sql`delete from milestones where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Marco não encontrado.");
}
