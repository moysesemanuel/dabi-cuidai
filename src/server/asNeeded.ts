import type { AsNeededDose, AsNeededDoseInput, NewAsNeeded } from "@/lib/types";
import type { Session } from "./auth";
import { MAX_TEMPERATURE, MIN_TEMPERATURE } from "./diary";
import { HttpError } from "./http";
import { sql } from "./sql";

const DAY = 86_400_000;
/** Registros retroativos de até uma semana (esqueci de anotar na hora). */
const MAX_BACKDATE_DAYS = 7;

const text = (value: unknown, max: number, label: string, required: boolean): string => {
  if (value !== undefined && value !== null && typeof value !== "string") throw new HttpError(400, `${label} inválido.`);
  const clean = (value ?? "").toString().trim().replace(/[ \t]+/g, " ");
  if (required && !clean) throw new HttpError(400, `${label} é obrigatório.`);
  if (clean.length > max) throw new HttpError(400, `${label} muito longo.`);
  return clean;
};

/** Confere um remédio "se necessário": criança, nome, dose da receita e a orientação (opcional), como texto. */
export function parseAsNeeded(body: Record<string, unknown>): NewAsNeeded {
  const childId = body.childId;
  if (typeof childId !== "number" || !Number.isSafeInteger(childId) || childId < 1) throw new HttpError(400, "Escolha a criança.");
  return {
    childId,
    name: text(body.name, 100, "Nome do remédio", true),
    doseText: text(body.doseText, 200, "Dose", true),
    instructions: text(body.instructions, 300, "Orientação", false),
  };
}

/** Confere uma dose registrada: quando foi dada (não no futuro), motivo e temperatura opcionais. */
export function parseAsNeededDose(body: Record<string, unknown>, now = Date.now()): AsNeededDoseInput {
  const givenAt = body.givenAt;
  if (typeof givenAt !== "number" || !Number.isSafeInteger(givenAt)) throw new HttpError(400, "Data e hora inválidas.");
  if (givenAt > now + 3_600_000) throw new HttpError(400, "A data e hora não podem ser no futuro.");
  if (givenAt < now - MAX_BACKDATE_DAYS * DAY) throw new HttpError(400, "Registre doses de até 7 dias atrás.");
  let temperature: number | null = null;
  if (body.temperature !== undefined && body.temperature !== null) {
    const t = body.temperature;
    if (typeof t !== "number" || !Number.isFinite(t)) throw new HttpError(400, "Temperatura inválida.");
    temperature = Math.round(t * 10) / 10;
    if (temperature < MIN_TEMPERATURE || temperature > MAX_TEMPERATURE) {
      throw new HttpError(400, `A temperatura precisa estar entre ${MIN_TEMPERATURE} e ${MAX_TEMPERATURE} °C.`);
    }
  }
  return { givenAt, reason: text(body.reason, 120, "Motivo", false), temperature };
}

async function assertChild(session: Session, childId: number): Promise<void> {
  const rows = await sql`select 1 from children where id = ${childId} and family_id = ${session.familyId}`;
  if (!rows.length) throw new HttpError(400, "Criança não encontrada.");
}

export async function createAsNeeded(session: Session, input: NewAsNeeded, now = Date.now()): Promise<number> {
  await assertChild(session, input.childId);
  const [row] = await sql<{ id: number }[]>`
    insert into medications (family_id, child_id, kind, name, dose_text, instructions, created_at)
    values (${session.familyId}, ${input.childId}, 'as_needed', ${input.name}, ${input.doseText}, ${input.instructions}, ${now})
    returning id`;
  return row.id;
}

/** Editar o remédio não muda as doses já registradas: elas guardam o nome, a dose e a criança da época. */
export async function updateAsNeeded(session: Session, id: number, input: NewAsNeeded): Promise<void> {
  await assertChild(session, input.childId);
  const rows = await sql`
    update medications set child_id = ${input.childId}, name = ${input.name}, dose_text = ${input.doseText},
      instructions = ${input.instructions}
    where id = ${id} and family_id = ${session.familyId} and kind = 'as_needed' and deleted_at is null returning id`;
  if (!rows.length) throw new HttpError(404, "Remédio não encontrado.");
}

async function getMed(session: Session, id: number) {
  const [med] = await sql<{ child_id: number; name: string; dose_text: string }[]>`
    select child_id, name, dose_text from medications
    where id = ${id} and family_id = ${session.familyId} and kind = 'as_needed' and deleted_at is null`;
  if (!med) throw new HttpError(404, "Remédio não encontrado.");
  return med;
}

/** Registra que a dose foi dada. Já nasce como "dada": não entra na fila de avisos. */
export async function registerAsNeededDose(session: Session, medicationId: number, input: AsNeededDoseInput): Promise<number> {
  const med = await getMed(session, medicationId);
  const [row] = await sql<{ id: number }[]>`
    insert into doses (family_id, medication_id, child_id, med_name, dose_text, interval_minutes, scheduled_at,
                       status, given_at, given_by, reason, temp_tenths)
    values (${session.familyId}, ${medicationId}, ${med.child_id}, ${med.name}, ${med.dose_text}, null, ${input.givenAt},
            'given', ${input.givenAt}, ${session.deviceId}, ${input.reason},
            ${input.temperature === null ? null : Math.round(input.temperature * 10)})
    returning id`;
  return row.id;
}

/** As últimas doses registradas desse remédio, mais recentes primeiro. */
export async function listAsNeededDoses(session: Session, medicationId: number, limit = 20): Promise<AsNeededDose[]> {
  await getMed(session, medicationId);
  const rows = await sql<{ id: number; given_at: number; reason: string; temp_tenths: number | null }[]>`
    select id, given_at, reason, temp_tenths from doses
    where medication_id = ${medicationId} and family_id = ${session.familyId}
    order by given_at desc, id desc limit ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    givenAt: r.given_at,
    reason: r.reason,
    temperature: r.temp_tenths === null ? undefined : r.temp_tenths / 10,
  }));
}

/** Apaga uma dose registrada por engano. Só vale para remédios "se necessário". */
export async function deleteAsNeededDose(session: Session, doseId: number): Promise<void> {
  const rows = await sql`
    delete from doses d using medications m
    where d.id = ${doseId} and d.family_id = ${session.familyId}
      and m.id = d.medication_id and m.kind = 'as_needed'
    returning d.id`;
  if (!rows.length) throw new HttpError(404, "Registro não encontrado.");
}
