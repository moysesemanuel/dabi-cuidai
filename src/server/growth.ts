import { daysBetween, parseCivilDate, toIso, todayCivil, type CivilDate } from "@/lib/age";
import {
  MAX_LENGTH_MM,
  MAX_WEIGHT_G,
  MIN_LENGTH_MM,
  MIN_WEIGHT_G,
  type GrowthInput,
  type GrowthMeasurement,
} from "@/lib/growth";
import type { Session } from "./auth";
import { HttpError } from "./http";
import { sql } from "./sql";

const MAX_NOTE_LENGTH = 500;

const optionalInt = (value: unknown, min: number, max: number, message: string): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new HttpError(400, message);
  return value;
};

/** Confere uma medição. Precisa ter peso ou comprimento; a data não pode ser futura. */
export function parseGrowthInput(body: Record<string, unknown>, today: CivilDate = todayCivil()): GrowthInput {
  const childId = body.childId;
  if (typeof childId !== "number" || !Number.isSafeInteger(childId) || childId < 1) throw new HttpError(400, "Escolha a criança.");
  const date = typeof body.measuredOn === "string" ? parseCivilDate(body.measuredOn) : null;
  if (!date) throw new HttpError(400, "Data da medição inválida.");
  // Um dia de folga: o servidor pode já estar no dia seguinte ao do aparelho.
  if (daysBetween(today, date) > 1) throw new HttpError(400, "A data da medição não pode ser no futuro.");
  const weightG = optionalInt(body.weightG, MIN_WEIGHT_G, MAX_WEIGHT_G, "O peso precisa estar entre 0,3 e 40 kg.");
  const lengthMm = optionalInt(body.lengthMm, MIN_LENGTH_MM, MAX_LENGTH_MM, "O comprimento precisa estar entre 25 e 150 cm.");
  if (weightG === null && lengthMm === null) throw new HttpError(400, "Informe o peso, o comprimento ou os dois.");
  const note = typeof body.note === "string" ? body.note.trim() : body.note == null ? "" : null;
  if (note === null || note.length > MAX_NOTE_LENGTH) throw new HttpError(400, "Observação inválida ou muito longa.");
  return { childId, measuredOn: toIso(date), weightG, lengthMm, note };
}

interface Row {
  id: number;
  child_id: number;
  measured_on: string;
  weight_g: number | null;
  length_mm: number | null;
  note: string;
}

const toMeasurement = (r: Row): GrowthMeasurement => ({
  id: r.id,
  childId: r.child_id,
  measuredOn: r.measured_on,
  weightG: r.weight_g ?? undefined,
  lengthMm: r.length_mm ?? undefined,
  note: r.note,
});

/** Confere que a criança é da família e que a medição não é de antes do nascimento. */
async function assertChild(session: Session, input: GrowthInput): Promise<void> {
  const [child] = await sql<{ birth_date: string | null }[]>`
    select birth_date::text as birth_date from children where id = ${input.childId} and family_id = ${session.familyId}`;
  if (!child) throw new HttpError(404, "Criança não encontrada.");
  if (child.birth_date && input.measuredOn < child.birth_date) {
    throw new HttpError(400, "A data da medição é anterior ao nascimento.");
  }
}

const COLUMNS = sql`id, child_id, measured_on::text as measured_on, weight_g, length_mm, note`;

/** Todas as medições de uma criança, da mais antiga para a mais recente. */
export async function listGrowth(session: Session, childId: number): Promise<GrowthMeasurement[]> {
  const rows = await sql<Row[]>`
    select ${COLUMNS} from growth_measurements
    where family_id = ${session.familyId} and child_id = ${childId}
    order by measured_on, id`;
  if (!rows.length) {
    const kid = await sql`select 1 from children where id = ${childId} and family_id = ${session.familyId}`;
    if (!kid.length) throw new HttpError(404, "Criança não encontrada.");
  }
  return rows.map(toMeasurement);
}

export async function getGrowth(session: Session, id: number): Promise<GrowthMeasurement> {
  const [row] = await sql<Row[]>`select ${COLUMNS} from growth_measurements where id = ${id} and family_id = ${session.familyId}`;
  if (!row) throw new HttpError(404, "Medição não encontrada.");
  return toMeasurement(row);
}

export async function createGrowth(session: Session, input: GrowthInput, now = Date.now()): Promise<number> {
  await assertChild(session, input);
  const [row] = await sql<{ id: number }[]>`
    insert into growth_measurements (family_id, child_id, measured_on, weight_g, length_mm, note, created_by, created_at, updated_at)
    values (${session.familyId}, ${input.childId}, ${input.measuredOn}::date, ${input.weightG}, ${input.lengthMm},
            ${input.note}, ${session.deviceId}, ${now}, ${now})
    returning id`;
  return row.id;
}

export async function updateGrowth(session: Session, id: number, input: GrowthInput, now = Date.now()): Promise<void> {
  await assertChild(session, input);
  const rows = await sql`
    update growth_measurements set child_id = ${input.childId}, measured_on = ${input.measuredOn}::date,
      weight_g = ${input.weightG}, length_mm = ${input.lengthMm}, note = ${input.note}, updated_at = ${now}
    where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Medição não encontrada.");
}

export async function deleteGrowth(session: Session, id: number): Promise<void> {
  const rows = await sql`delete from growth_measurements where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Medição não encontrada.");
}
