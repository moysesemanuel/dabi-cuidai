import { generateDoseTimes, MAX_DAYS, MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from "@/lib/schedule";
import {
  CHILD_COLORS,
  type AppState,
  type Child,
  type DoseEvent,
  type DoseHistoryItem,
  type Medication,
  type NewMedication,
} from "@/lib/types";
import { daysBetween, MIN_GA_WEEKS, parseCivilDate, PRETERM_WEEKS_LIMIT, toIso, todayCivil, type CivilDate } from "@/lib/age";
import { HttpError } from "./http";
import { sql } from "./sql";
import type { Session } from "./auth";

const HOUR = 3_600_000;

// ---------- validação ----------

const text = (value: unknown, max: number, label: string, required: boolean): string => {
  if (typeof value !== "string") throw new HttpError(400, `${label} inválido.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, `${label} é obrigatório.`);
  if (trimmed.length > max) throw new HttpError(400, `${label} muito longo.`);
  return trimmed;
};

const int = (value: unknown, min: number, max: number, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${label} inválido.`);
  }
  return value;
};

export function parseMedication(body: Record<string, unknown>): NewMedication {
  const now = Date.now();
  return {
    childId: int(body.childId, 1, Number.MAX_SAFE_INTEGER, "Criança"),
    name: text(body.name, 100, "Nome do remédio", true),
    doseText: text(body.doseText ?? "", 200, "Dose", false),
    intervalMinutes: int(body.intervalMinutes, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES, "Intervalo"),
    // Janela larga o bastante para edições e cadastros retroativos, mas descarta lixo.
    firstDoseAt: int(body.firstDoseAt, now - 400 * 24 * HOUR, now + 400 * 24 * HOUR, "Horário da primeira dose"),
    days: int(body.days, 1, MAX_DAYS, "Dias"),
  };
}

// ---------- leitura ----------

interface ChildRow {
  id: number;
  name: string;
  fill: string;
  photo_version: number | null;
  birth_date: string | null;
  premature: "yes" | "no" | null;
  ga_weeks: number | null;
  ga_days: number | null;
}
interface MedRow { id: number; child_id: number; name: string; dose_text: string; interval_minutes: number; first_dose_at: number; days: number; created_at: number }
interface DoseRow { id: number; medication_id: number; scheduled_at: number; status: "pending" | "given"; given_at: number | null }

export async function getState(session: Session, dayStart: number): Promise<AppState> {
  const familyId = session.familyId;
  const [family] = await sql<{ code: string }[]>`select code from families where id = ${familyId}`;
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::bigint as count from devices where family_id = ${familyId}`;
  const [device] = await sql<{ label: string | null }[]>`select label from devices where id = ${session.deviceId}`;
  const [{ pushCount }] = await sql<{ pushCount: number }[]>`
    select count(distinct s.device_id)::bigint as "pushCount"
    from push_subscriptions s join devices d on d.id = s.device_id where d.family_id = ${familyId}`;
  const children = await sql<ChildRow[]>`
    select id, name, fill, photo_version, birth_date::text as birth_date, premature, ga_weeks, ga_days
    from children where family_id = ${familyId} order by id`;
  const meds = await sql<MedRow[]>`
    select id, child_id, name, dose_text, interval_minutes, first_dose_at, days, created_at
    from medications where family_id = ${familyId} and deleted_at is null order by id`;
  const doses = await sql<DoseRow[]>`
    select d.id, d.medication_id, d.scheduled_at, d.status, d.given_at from doses d
    join medications m on m.id = d.medication_id and m.deleted_at is null
    where d.family_id = ${familyId} and d.scheduled_at >= ${dayStart - 6 * HOUR} and d.scheduled_at < ${dayStart + 24 * HOUR}
    order by d.scheduled_at`;

  return {
    familyCode: family.code,
    deviceId: session.deviceId,
    deviceName: device?.label || undefined,
    deviceCount: count,
    pushDeviceCount: pushCount,
    children: children.map(
      (c): Child => ({
        id: c.id,
        name: c.name,
        fill: c.fill,
        photoUrl: c.photo_version ? `/api/children/${c.id}/photo?v=${c.photo_version}` : undefined,
        birthDate: c.birth_date ?? undefined,
        premature: c.premature ?? undefined,
        gestationalAge: c.ga_weeks !== null && c.ga_days !== null ? { weeks: c.ga_weeks, days: c.ga_days } : undefined,
      }),
    ),
    medications: meds.map(
      (m): Medication => ({
        id: m.id,
        childId: m.child_id,
        name: m.name,
        doseText: m.dose_text,
        intervalMinutes: m.interval_minutes,
        firstDoseAt: m.first_dose_at,
        days: m.days,
        createdAt: m.created_at,
      }),
    ),
    doses: doses.map(
      (d): DoseEvent => ({
        id: d.id,
        medicationId: d.medication_id,
        scheduledAt: d.scheduled_at,
        status: d.status,
        givenAt: d.given_at ?? undefined,
      }),
    ),
  };
}

// ---------- este aparelho ----------

/** Nome de quem usa o aparelho. Vazio apaga. */
export async function setDeviceName(session: Session, body: Record<string, unknown>): Promise<void> {
  const name = text(body.name ?? "", 30, "Nome", false);
  await sql`update devices set label = ${name || null} where id = ${session.deviceId}`;
}

// ---------- crianças ----------

export async function addChild(session: Session): Promise<void> {
  const kids = await sql<{ fill: string }[]>`select fill from children where family_id = ${session.familyId}`;
  const color = CHILD_COLORS.find((c) => !kids.some((k) => k.fill === c.fill)) ?? CHILD_COLORS[kids.length % CHILD_COLORS.length];
  await sql`
    insert into children (family_id, name, fill, created_at)
    values (${session.familyId}, ${`Criança ${kids.length + 1}`}, ${color.fill}, ${Date.now()})`;
}

type ChildColumns = {
  name: string;
  fill: string;
  birth_date: string | null;
  premature: "yes" | "no" | null;
  ga_weeks: number | null;
  ga_days: number | null;
};

/**
 * Junta o que já está salvo com o que chegou e confere as regras do perfil.
 * Só o que vier no corpo muda; `null` apaga. Deixar de ser prematuro apaga a idade gestacional.
 */
export function mergeChildPatch(current: ChildColumns, body: Record<string, unknown>, today: CivilDate): ChildColumns {
  const next = { ...current };
  if (body.name !== undefined) next.name = text(body.name, 30, "Nome", true);
  if (body.fill !== undefined) {
    const fill = CHILD_COLORS.find((c) => c.fill === body.fill)?.fill;
    if (!fill) throw new HttpError(400, "Cor inválida.");
    next.fill = fill;
  }
  if (body.birthDate !== undefined) {
    if (body.birthDate === null) next.birth_date = null;
    else {
      const date = typeof body.birthDate === "string" ? parseCivilDate(body.birthDate) : null;
      if (!date) throw new HttpError(400, "Data de nascimento inválida.");
      // Um dia de folga: o servidor pode já estar no dia seguinte ao do aparelho.
      if (daysBetween(today, date) > 1) throw new HttpError(400, "A data de nascimento não pode ser no futuro.");
      if (daysBetween(date, today) > MAX_CHILD_AGE_DAYS) throw new HttpError(400, "Data de nascimento antiga demais.");
      next.birth_date = toIso(date);
    }
  }
  if (body.premature !== undefined) {
    if (body.premature !== null && body.premature !== "yes" && body.premature !== "no") {
      throw new HttpError(400, "Valor de prematuro inválido.");
    }
    next.premature = body.premature;
  }
  if (body.gestationalAge !== undefined) {
    const ga = body.gestationalAge as { weeks?: unknown; days?: unknown } | null;
    if (ga === null) {
      next.ga_weeks = null;
      next.ga_days = null;
    } else {
      if (!ga || typeof ga !== "object") throw new HttpError(400, "Idade gestacional inválida.");
      next.ga_weeks = int(ga.weeks, MIN_GA_WEEKS, PRETERM_WEEKS_LIMIT - 1, "Semanas de gestação");
      next.ga_days = int(ga.days ?? 0, 0, 6, "Dias de gestação");
    }
  }
  if (next.premature !== "yes") {
    if (body.gestationalAge !== undefined && body.gestationalAge !== null) {
      throw new HttpError(400, "Idade gestacional só para quem nasceu prematuro.");
    }
    next.ga_weeks = null;
    next.ga_days = null;
  }
  return next;
}

/** 18 anos: o app é para crianças; mais que isso é quase certamente erro de digitação. */
const MAX_CHILD_AGE_DAYS = 18 * 366;

export async function updateChild(session: Session, id: number, body: Record<string, unknown>): Promise<void> {
  await sql.begin(async (tx) => {
    const [current] = await tx<ChildColumns[]>`
      select name, fill, birth_date::text as birth_date, premature, ga_weeks, ga_days
      from children where id = ${id} and family_id = ${session.familyId} for update`;
    if (!current) throw new HttpError(404, "Criança não encontrada.");
    const next = mergeChildPatch(current, body, todayCivil());
    await tx`
      update children set name = ${next.name}, fill = ${next.fill}, birth_date = ${next.birth_date}::date,
        premature = ${next.premature}, ga_weeks = ${next.ga_weeks}, ga_days = ${next.ga_days}
      where id = ${id}`;
  });
}

export async function deleteChild(session: Session, id: number): Promise<void> {
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::bigint as count from children where family_id = ${session.familyId}`;
  if (count <= 1) throw new HttpError(400, "É preciso manter pelo menos uma criança.");
  // Remédios e doses saem junto (on delete cascade).
  const rows = await sql`delete from children where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Criança não encontrada.");
}

// ---------- foto da criança ----------

/** Tamanho máximo aceito. O app envia 256×256 comprimido (≈10–30 KB); isso deixa folga sem aceitar fotos cruas. */
export const MAX_PHOTO_BYTES = 150_000;

/** Confere pelos primeiros bytes que é mesmo WebP ou JPEG, sem confiar só no cabeçalho da requisição. */
export function photoType(bytes: Uint8Array): "image/webp" | "image/jpeg" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

export async function setChildPhoto(session: Session, id: number, bytes: Uint8Array): Promise<void> {
  if (bytes.length === 0) throw new HttpError(400, "Foto vazia.");
  if (bytes.length > MAX_PHOTO_BYTES) throw new HttpError(413, "Foto grande demais.");
  const type = photoType(bytes);
  if (!type) throw new HttpError(415, "Formato de foto não aceito.");
  const rows = await sql`
    update children set photo = ${Buffer.from(bytes)}, photo_type = ${type}, photo_version = ${Date.now()}
    where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Criança não encontrada.");
}

export async function getChildPhoto(session: Session, id: number): Promise<{ bytes: Buffer; type: string } | null> {
  const [row] = await sql<{ photo: Buffer | null; photo_type: string | null }[]>`
    select photo, photo_type from children where id = ${id} and family_id = ${session.familyId}`;
  return row?.photo && row.photo_type ? { bytes: row.photo, type: row.photo_type } : null;
}

export async function deleteChildPhoto(session: Session, id: number): Promise<void> {
  const rows = await sql`
    update children set photo = null, photo_type = null, photo_version = null
    where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Criança não encontrada.");
}

// ---------- remédios ----------

async function assertChild(session: Session, childId: number): Promise<void> {
  const rows = await sql`select 1 from children where id = ${childId} and family_id = ${session.familyId}`;
  if (!rows.length) throw new HttpError(400, "Criança não encontrada.");
}

/** Colunas de uma dose nova. A cópia de criança, nome e dose congela o histórico (ver db/schema.sql). */
const DOSE_COLUMNS = ["family_id", "medication_id", "child_id", "med_name", "dose_text", "scheduled_at"] as const;

const doseRows = (familyId: string, medicationId: number, med: NewMedication, times: number[]) =>
  times.map((scheduledAt) => ({
    family_id: familyId,
    medication_id: medicationId,
    child_id: med.childId,
    med_name: med.name,
    dose_text: med.doseText,
    scheduled_at: scheduledAt,
  }));

export async function createMedication(session: Session, input: NewMedication): Promise<number> {
  await assertChild(session, input.childId);
  return sql.begin(async (tx) => {
    const [med] = await tx<{ id: number }[]>`
      insert into medications (family_id, child_id, name, dose_text, interval_minutes, first_dose_at, days, created_at)
      values (${session.familyId}, ${input.childId}, ${input.name}, ${input.doseText}, ${input.intervalMinutes},
              ${input.firstDoseAt}, ${input.days}, ${Date.now()})
      returning id`;
    const rows = doseRows(session.familyId, med.id, input, generateDoseTimes(input.firstDoseAt, input.intervalMinutes, input.days));
    await tx`insert into doses ${tx(rows, ...DOSE_COLUMNS)}`;
    return med.id;
  });
}

/**
 * Edita um remédio. A mudança vale a partir de `from` (começo de hoje no aparelho de quem editou):
 * doses pendentes dali em diante são refeitas; doses já dadas e dias anteriores ficam como estão.
 */
export async function updateMedication(session: Session, id: number, input: NewMedication, from: number): Promise<void> {
  await assertChild(session, input.childId);
  await sql.begin(async (tx) => {
    const updated = await tx`
      update medications set child_id = ${input.childId}, name = ${input.name}, dose_text = ${input.doseText},
        interval_minutes = ${input.intervalMinutes}, first_dose_at = ${input.firstDoseAt}, days = ${input.days}
      where id = ${id} and family_id = ${session.familyId} and deleted_at is null returning id`;
    if (!updated.length) throw new HttpError(404, "Remédio não encontrado.");
    await tx`delete from doses where medication_id = ${id} and status = 'pending' and scheduled_at >= ${from}`;
    const kept = new Set(
      (await tx<{ scheduled_at: number }[]>`select scheduled_at from doses where medication_id = ${id}`).map((d) => d.scheduled_at),
    );
    const times = generateDoseTimes(input.firstDoseAt, input.intervalMinutes, input.days).filter(
      (t) => t >= from && !kept.has(t),
    );
    if (times.length) {
      await tx`insert into doses ${tx(doseRows(session.familyId, id, input, times), ...DOSE_COLUMNS)}`;
    }
  });
}

/**
 * Remove um remédio da lista sem apagar o histórico: o remédio fica marcado como removido, as doses
 * que já passaram continuam (dadas ou não) e só as que ainda viriam são apagadas, para não gerar aviso.
 */
export async function deleteMedication(session: Session, id: number, now = Date.now()): Promise<void> {
  await sql.begin(async (tx) => {
    const rows = await tx`
      update medications set deleted_at = ${now}
      where id = ${id} and family_id = ${session.familyId} and deleted_at is null returning id`;
    if (!rows.length) throw new HttpError(404, "Remédio não encontrado.");
    await tx`delete from doses where medication_id = ${id} and status = 'pending' and scheduled_at > ${now}`;
  });
}

// ---------- doses ----------

export async function setDoseGiven(session: Session, id: number, given: boolean): Promise<void> {
  const rows = given
    ? await sql`
        update doses set status = 'given', given_at = ${Date.now()}, given_by = ${session.deviceId}
        where id = ${id} and family_id = ${session.familyId} returning id`
    : await sql`
        update doses set status = 'pending', given_at = null, given_by = null, notified_count = 0, last_notified_at = null
        where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Dose não encontrada.");
}

// ---------- histórico ----------

/** Maior período de uma consulta de histórico (o resumo para consulta usa até alguns meses). */
export const MAX_HISTORY_DAYS = 400;

export interface HistoryQuery { childId?: number; from: number; to: number }

export function parseHistoryQuery(params: URLSearchParams, now = Date.now()): HistoryQuery {
  const num = (name: string) => {
    const raw = params.get(name);
    return raw === null || raw === "" ? undefined : Number(raw);
  };
  const childId = num("childId");
  if (childId !== undefined && (!Number.isSafeInteger(childId) || childId < 1)) throw new HttpError(400, "Criança inválida.");
  const to = num("to") ?? now;
  const from = num("from") ?? to - 30 * 24 * HOUR;
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || from >= to) {
    throw new HttpError(400, "Período inválido.");
  }
  if (to - from > MAX_HISTORY_DAYS * 24 * HOUR) throw new HttpError(400, "Período longo demais.");
  return { childId, from, to };
}

/**
 * Doses de [from, to) que já chegaram na hora, mais recentes primeiro. Inclui as de remédios removidos,
 * e cada uma vem com o nome e a dose de quando foi agendada. Doses futuras ficam de fora: ainda não são histórico.
 */
export async function getDoseHistory(session: Session, q: HistoryQuery, now = Date.now()): Promise<DoseHistoryItem[]> {
  if (q.childId !== undefined) {
    const rows = await sql`select 1 from children where id = ${q.childId} and family_id = ${session.familyId}`;
    if (!rows.length) throw new HttpError(404, "Criança não encontrada.");
  }
  const until = Math.min(q.to, now + 1);
  const rows = await sql<
    {
      id: number;
      child_id: number;
      medication_id: number;
      med_name: string;
      dose_text: string;
      scheduled_at: number;
      status: "pending" | "given";
      given_at: number | null;
      removed: boolean;
    }[]
  >`
    select d.id, d.child_id, d.medication_id, d.med_name, d.dose_text, d.scheduled_at, d.status, d.given_at,
           (m.deleted_at is not null) as removed
    from doses d join medications m on m.id = d.medication_id
    where d.family_id = ${session.familyId}
      ${q.childId !== undefined ? sql`and d.child_id = ${q.childId}` : sql``}
      and d.scheduled_at >= ${q.from} and d.scheduled_at < ${until}
    order by d.scheduled_at desc, d.id desc
    limit 5000`;
  return rows.map((r) => ({
    id: r.id,
    childId: r.child_id,
    medicationId: r.medication_id,
    medName: r.med_name,
    doseText: r.dose_text,
    scheduledAt: r.scheduled_at,
    status: r.status,
    givenAt: r.given_at ?? undefined,
    medicationRemoved: r.removed,
  }));
}

// ---------- importar os dados deste aparelho (versão antiga, só local) ----------

interface ImportBody {
  children: { id: number; name: string; fill: string }[];
  medications: (NewMedication & { id: number; createdAt?: number })[];
  doses: { medicationId: number; scheduledAt: number; status: "pending" | "given"; givenAt?: number }[];
}

export function parseImport(body: Record<string, unknown>): ImportBody {
  const list = (value: unknown, max: number, label: string): Record<string, unknown>[] => {
    if (!Array.isArray(value) || value.length > max) throw new HttpError(400, `${label} inválidos.`);
    return value.map((v) => {
      if (!v || typeof v !== "object") throw new HttpError(400, `${label} inválidos.`);
      return v as Record<string, unknown>;
    });
  };
  const children = list(body.children, 20, "Crianças").map((c) => ({
    id: int(c.id, 1, Number.MAX_SAFE_INTEGER, "Criança"),
    name: text(c.name, 30, "Nome", true),
    fill: CHILD_COLORS.find((x) => x.fill === c.fill)?.fill ?? CHILD_COLORS[0].fill,
  }));
  const medications = list(body.medications, 200, "Remédios").map((m) => ({
    ...parseMedication(m),
    id: int(m.id, 1, Number.MAX_SAFE_INTEGER, "Remédio"),
  }));
  const doses = list(body.doses, 6000, "Doses").map((d) => ({
    medicationId: int(d.medicationId, 1, Number.MAX_SAFE_INTEGER, "Remédio"),
    scheduledAt: int(d.scheduledAt, 0, Number.MAX_SAFE_INTEGER, "Horário"),
    status: d.status === "given" ? ("given" as const) : ("pending" as const),
    givenAt: typeof d.givenAt === "number" ? d.givenAt : undefined,
  }));
  return { children, medications, doses };
}

/** Só aceita importar para uma família que ainda não tem remédios (evita duplicar sem querer). */
export async function importLocal(session: Session, data: ImportBody): Promise<void> {
  await sql.begin(async (tx) => {
    const [{ count }] = await tx<{ count: number }[]>`
      select count(*)::bigint as count from medications where family_id = ${session.familyId}`;
    if (count > 0) throw new HttpError(409, "Esta família já tem remédios; importação cancelada.");
    // A importação troca as crianças da família: nunca quando já há diário, que seria apagado junto.
    const [{ entries }] = await tx<{ entries: number }[]>`
      select count(*)::bigint as entries from health_entries where family_id = ${session.familyId}`;
    if (entries > 0) throw new HttpError(409, "Esta família já tem registros no diário; importação cancelada.");
    if (!data.children.length) throw new HttpError(400, "Nada para importar.");

    await tx`delete from children where family_id = ${session.familyId}`;
    const childMap = new Map<number, number>();
    for (const c of data.children) {
      const [row] = await tx<{ id: number }[]>`
        insert into children (family_id, name, fill, created_at)
        values (${session.familyId}, ${c.name}, ${c.fill}, ${Date.now()}) returning id`;
      childMap.set(c.id, row.id);
    }
    const medMap = new Map<number, { id: number; med: NewMedication }>();
    for (const m of data.medications) {
      const childId = childMap.get(m.childId);
      if (!childId) continue;
      const [row] = await tx<{ id: number }[]>`
        insert into medications (family_id, child_id, name, dose_text, interval_minutes, first_dose_at, days, created_at)
        values (${session.familyId}, ${childId}, ${m.name}, ${m.doseText}, ${m.intervalMinutes}, ${m.firstDoseAt}, ${m.days}, ${Date.now()})
        returning id`;
      medMap.set(m.id, { id: row.id, med: { ...m, childId } });
    }
    const rows = data.doses.flatMap((d) => {
      const target = medMap.get(d.medicationId);
      return target
        ? [{ ...doseRows(session.familyId, target.id, target.med, [d.scheduledAt])[0], status: d.status, given_at: d.givenAt ?? null }]
        : [];
    });
    for (let i = 0; i < rows.length; i += 500) {
      await tx`insert into doses ${tx(rows.slice(i, i + 500), ...DOSE_COLUMNS, "status", "given_at")}`;
    }
  });
}
