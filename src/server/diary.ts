import type { HealthEntry, HealthEntryInput } from "@/lib/types";
import type { Session } from "./auth";
import { HttpError } from "./http";
import { sql } from "./sql";

const DAY = 86_400_000;
export const MIN_TEMPERATURE = 34;
export const MAX_TEMPERATURE = 43;
const MAX_SYMPTOMS = 12;
const MAX_SYMPTOM_LENGTH = 40;
const MAX_NOTE_LENGTH = 1000;
/** Registros retroativos de até ~1 ano (o mesmo alcance do histórico). */
const MAX_BACKDATE_DAYS = 400;

/** Confere um registro do diário. Precisa ter ao menos temperatura, sintoma ou anotação. */
export function parseHealthEntry(body: Record<string, unknown>, now = Date.now()): HealthEntryInput {
  const childId = body.childId;
  if (typeof childId !== "number" || !Number.isSafeInteger(childId) || childId < 1) throw new HttpError(400, "Escolha a criança.");

  const occurredAt = body.occurredAt;
  if (typeof occurredAt !== "number" || !Number.isSafeInteger(occurredAt)) throw new HttpError(400, "Data e hora inválidas.");
  // Uma hora de folga para relógios de aparelho um pouco adiantados.
  if (occurredAt > now + 3_600_000) throw new HttpError(400, "A data e hora não podem ser no futuro.");
  if (occurredAt < now - MAX_BACKDATE_DAYS * DAY) throw new HttpError(400, "Data antiga demais.");

  let temperature: number | null = null;
  if (body.temperature !== undefined && body.temperature !== null) {
    const t = body.temperature;
    if (typeof t !== "number" || !Number.isFinite(t)) throw new HttpError(400, "Temperatura inválida.");
    temperature = Math.round(t * 10) / 10;
    if (temperature < MIN_TEMPERATURE || temperature > MAX_TEMPERATURE) {
      throw new HttpError(400, `A temperatura precisa estar entre ${MIN_TEMPERATURE} e ${MAX_TEMPERATURE} °C.`);
    }
  }

  const rawSymptoms = body.symptoms ?? [];
  if (!Array.isArray(rawSymptoms) || rawSymptoms.length > MAX_SYMPTOMS) throw new HttpError(400, "Sintomas inválidos.");
  const symptoms: string[] = [];
  for (const s of rawSymptoms) {
    if (typeof s !== "string") throw new HttpError(400, "Sintomas inválidos.");
    const clean = s.trim().replace(/\s+/g, " ");
    if (clean.length > MAX_SYMPTOM_LENGTH) throw new HttpError(400, "Sintoma muito longo.");
    if (clean && !symptoms.some((x) => x.toLowerCase() === clean.toLowerCase())) symptoms.push(clean);
  }

  const note = typeof body.note === "string" ? body.note.trim() : body.note == null ? "" : null;
  if (note === null) throw new HttpError(400, "Anotação inválida.");
  if (note.length > MAX_NOTE_LENGTH) throw new HttpError(400, "Anotação muito longa.");

  if (temperature === null && !symptoms.length && !note) {
    throw new HttpError(400, "Registre uma temperatura, um sintoma ou uma anotação.");
  }
  return { childId, occurredAt, temperature, symptoms, note };
}

interface EntryRow {
  id: number;
  child_id: number;
  occurred_at: number;
  temp_tenths: number | null;
  symptoms: string[];
  note: string;
  created_at: number;
  updated_at: number;
}

const toEntry = (r: EntryRow): HealthEntry => ({
  id: r.id,
  childId: r.child_id,
  occurredAt: r.occurred_at,
  temperature: r.temp_tenths === null ? undefined : r.temp_tenths / 10,
  symptoms: r.symptoms,
  note: r.note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const tenths = (t: number | null) => (t === null ? null : Math.round(t * 10));

async function assertChild(session: Session, childId: number): Promise<void> {
  const rows = await sql`select 1 from children where id = ${childId} and family_id = ${session.familyId}`;
  if (!rows.length) throw new HttpError(404, "Criança não encontrada.");
}

export interface DiaryQuery { childId?: number; from: number; to: number }

/** Registros de [from, to), mais recentes primeiro. */
export async function listHealthEntries(session: Session, q: DiaryQuery): Promise<HealthEntry[]> {
  if (q.childId !== undefined) await assertChild(session, q.childId);
  const rows = await sql<EntryRow[]>`
    select id, child_id, occurred_at, temp_tenths, symptoms, note, created_at, updated_at
    from health_entries
    where family_id = ${session.familyId}
      ${q.childId !== undefined ? sql`and child_id = ${q.childId}` : sql``}
      and occurred_at >= ${q.from} and occurred_at < ${q.to}
    order by occurred_at desc, id desc
    limit 2000`;
  return rows.map(toEntry);
}

export async function getHealthEntry(session: Session, id: number): Promise<HealthEntry> {
  const [row] = await sql<EntryRow[]>`
    select id, child_id, occurred_at, temp_tenths, symptoms, note, created_at, updated_at
    from health_entries where id = ${id} and family_id = ${session.familyId}`;
  if (!row) throw new HttpError(404, "Registro não encontrado.");
  return toEntry(row);
}

export async function createHealthEntry(session: Session, input: HealthEntryInput, now = Date.now()): Promise<number> {
  await assertChild(session, input.childId);
  const [row] = await sql<{ id: number }[]>`
    insert into health_entries (family_id, child_id, occurred_at, temp_tenths, symptoms, note, created_by, created_at, updated_at)
    values (${session.familyId}, ${input.childId}, ${input.occurredAt}, ${tenths(input.temperature)},
            ${input.symptoms}, ${input.note}, ${session.deviceId}, ${now}, ${now})
    returning id`;
  return row.id;
}

export async function updateHealthEntry(session: Session, id: number, input: HealthEntryInput, now = Date.now()): Promise<void> {
  await assertChild(session, input.childId);
  const rows = await sql`
    update health_entries set child_id = ${input.childId}, occurred_at = ${input.occurredAt},
      temp_tenths = ${tenths(input.temperature)}, symptoms = ${input.symptoms}, note = ${input.note}, updated_at = ${now}
    where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Registro não encontrado.");
}

export async function deleteHealthEntry(session: Session, id: number): Promise<void> {
  const rows = await sql`delete from health_entries where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Registro não encontrado.");
}

export interface DiaryMonth {
  /** "AAAA-MM" no fuso do aparelho. */
  month: string;
  entries: number;
  doses: number;
}

/** Confere o fuso enviado pelo aparelho (nome IANA, como "America/Sao_Paulo"). */
export function parseTimeZone(value: string | null): string {
  if (!value || value.length > 64) throw new HttpError(400, "Fuso horário inválido.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
  } catch {
    throw new HttpError(400, "Fuso horário inválido.");
  }
  return value;
}

/**
 * Quantos registros e doses (já vencidas) há em cada mês, no fuso do aparelho, dentro do alcance do histórico.
 * É o índice do Diário: cada mês só é carregado por inteiro quando a família o abre.
 */
export async function diaryMonths(
  session: Session,
  childId: number | undefined,
  timeZone: string,
  now = Date.now(),
): Promise<DiaryMonth[]> {
  if (childId !== undefined) await assertChild(session, childId);
  const from = now - MAX_BACKDATE_DAYS * DAY;
  const byChild = (column: string) => (childId !== undefined ? sql`and ${sql(column)} = ${childId}` : sql``);
  const rows = await sql<{ month: string; entries: number; doses: number }[]>`
    with e as (
      select to_char(to_timestamp(occurred_at / 1000.0) at time zone ${timeZone}, 'YYYY-MM') as month, count(*) as n
      from health_entries
      where family_id = ${session.familyId} ${byChild("child_id")} and occurred_at >= ${from}
      group by 1
    ), d as (
      select to_char(to_timestamp(scheduled_at / 1000.0) at time zone ${timeZone}, 'YYYY-MM') as month, count(*) as n
      from doses
      where family_id = ${session.familyId} ${byChild("child_id")} and scheduled_at >= ${from} and scheduled_at <= ${now}
      group by 1
    )
    select coalesce(e.month, d.month) as month, coalesce(e.n, 0)::bigint as entries, coalesce(d.n, 0)::bigint as doses
    from e full join d on d.month = e.month
    order by 1 desc`;
  return rows;
}
