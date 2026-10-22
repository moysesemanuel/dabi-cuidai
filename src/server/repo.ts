import { generateDoseTimes, MAX_DAYS, MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from "@/lib/schedule";
import { CHILD_COLORS, type AppState, type Child, type DoseEvent, type Medication, type NewMedication } from "@/lib/types";
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
    childId: int(body.childId, 1, Number.MAX_SAFE_INTEGER, "Bebê"),
    name: text(body.name, 100, "Nome do remédio", true),
    doseText: text(body.doseText ?? "", 200, "Dose", false),
    intervalMinutes: int(body.intervalMinutes, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES, "Intervalo"),
    // Janela larga o bastante para edições e cadastros retroativos, mas descarta lixo.
    firstDoseAt: int(body.firstDoseAt, now - 400 * 24 * HOUR, now + 400 * 24 * HOUR, "Horário da primeira dose"),
    days: int(body.days, 1, MAX_DAYS, "Dias"),
  };
}

// ---------- leitura ----------

interface ChildRow { id: number; name: string; fill: string }
interface MedRow { id: number; child_id: number; name: string; dose_text: string; interval_minutes: number; first_dose_at: number; days: number; created_at: number }
interface DoseRow { id: number; medication_id: number; scheduled_at: number; status: "pending" | "given"; given_at: number | null }

export async function getState(session: Session, dayStart: number): Promise<AppState> {
  const familyId = session.familyId;
  const [family] = await sql<{ code: string }[]>`select code from families where id = ${familyId}`;
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::bigint as count from devices where family_id = ${familyId}`;
  const [{ pushCount }] = await sql<{ pushCount: number }[]>`
    select count(distinct s.device_id)::bigint as "pushCount"
    from push_subscriptions s join devices d on d.id = s.device_id where d.family_id = ${familyId}`;
  const children = await sql<ChildRow[]>`
    select id, name, fill from children where family_id = ${familyId} order by id`;
  const meds = await sql<MedRow[]>`
    select id, child_id, name, dose_text, interval_minutes, first_dose_at, days, created_at
    from medications where family_id = ${familyId} order by id`;
  const doses = await sql<DoseRow[]>`
    select id, medication_id, scheduled_at, status, given_at from doses
    where family_id = ${familyId} and scheduled_at >= ${dayStart - 6 * HOUR} and scheduled_at < ${dayStart + 24 * HOUR}
    order by scheduled_at`;

  return {
    familyCode: family.code,
    deviceId: session.deviceId,
    deviceCount: count,
    pushDeviceCount: pushCount,
    children: children.map((c): Child => ({ id: c.id, name: c.name, fill: c.fill })),
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

// ---------- bebês ----------

export async function addChild(session: Session): Promise<void> {
  const kids = await sql<{ fill: string }[]>`select fill from children where family_id = ${session.familyId}`;
  const color = CHILD_COLORS.find((c) => !kids.some((k) => k.fill === c.fill)) ?? CHILD_COLORS[kids.length % CHILD_COLORS.length];
  await sql`
    insert into children (family_id, name, fill, created_at)
    values (${session.familyId}, ${`Bebê ${kids.length + 1}`}, ${color.fill}, ${Date.now()})`;
}

export async function updateChild(session: Session, id: number, body: Record<string, unknown>): Promise<void> {
  const name = body.name === undefined ? undefined : text(body.name, 30, "Nome", true);
  const fill =
    body.fill === undefined ? undefined : CHILD_COLORS.find((c) => c.fill === body.fill)?.fill;
  if (body.fill !== undefined && !fill) throw new HttpError(400, "Cor inválida.");
  const rows = await sql`
    update children set name = coalesce(${name ?? null}, name), fill = coalesce(${fill ?? null}, fill)
    where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Bebê não encontrado.");
}

export async function deleteChild(session: Session, id: number): Promise<void> {
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::bigint as count from children where family_id = ${session.familyId}`;
  if (count <= 1) throw new HttpError(400, "É preciso manter pelo menos um bebê.");
  // Remédios e doses saem junto (on delete cascade).
  const rows = await sql`delete from children where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Bebê não encontrado.");
}

// ---------- remédios ----------

async function assertChild(session: Session, childId: number): Promise<void> {
  const rows = await sql`select 1 from children where id = ${childId} and family_id = ${session.familyId}`;
  if (!rows.length) throw new HttpError(400, "Bebê não encontrado.");
}

const doseRows = (familyId: string, medicationId: number, times: number[]) =>
  times.map((scheduledAt) => ({ family_id: familyId, medication_id: medicationId, scheduled_at: scheduledAt }));

export async function createMedication(session: Session, input: NewMedication): Promise<number> {
  await assertChild(session, input.childId);
  return sql.begin(async (tx) => {
    const [med] = await tx<{ id: number }[]>`
      insert into medications (family_id, child_id, name, dose_text, interval_minutes, first_dose_at, days, created_at)
      values (${session.familyId}, ${input.childId}, ${input.name}, ${input.doseText}, ${input.intervalMinutes},
              ${input.firstDoseAt}, ${input.days}, ${Date.now()})
      returning id`;
    const rows = doseRows(session.familyId, med.id, generateDoseTimes(input.firstDoseAt, input.intervalMinutes, input.days));
    await tx`insert into doses ${tx(rows, "family_id", "medication_id", "scheduled_at")}`;
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
      where id = ${id} and family_id = ${session.familyId} returning id`;
    if (!updated.length) throw new HttpError(404, "Remédio não encontrado.");
    await tx`delete from doses where medication_id = ${id} and status = 'pending' and scheduled_at >= ${from}`;
    const kept = new Set(
      (await tx<{ scheduled_at: number }[]>`select scheduled_at from doses where medication_id = ${id}`).map((d) => d.scheduled_at),
    );
    const times = generateDoseTimes(input.firstDoseAt, input.intervalMinutes, input.days).filter(
      (t) => t >= from && !kept.has(t),
    );
    if (times.length) {
      await tx`insert into doses ${tx(doseRows(session.familyId, id, times), "family_id", "medication_id", "scheduled_at")}`;
    }
  });
}

export async function deleteMedication(session: Session, id: number): Promise<void> {
  const rows = await sql`delete from medications where id = ${id} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Remédio não encontrado.");
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
  const children = list(body.children, 20, "Bebês").map((c) => ({
    id: int(c.id, 1, Number.MAX_SAFE_INTEGER, "Bebê"),
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
    if (!data.children.length) throw new HttpError(400, "Nada para importar.");

    await tx`delete from children where family_id = ${session.familyId}`;
    const childMap = new Map<number, number>();
    for (const c of data.children) {
      const [row] = await tx<{ id: number }[]>`
        insert into children (family_id, name, fill, created_at)
        values (${session.familyId}, ${c.name}, ${c.fill}, ${Date.now()}) returning id`;
      childMap.set(c.id, row.id);
    }
    const medMap = new Map<number, number>();
    for (const m of data.medications) {
      const childId = childMap.get(m.childId);
      if (!childId) continue;
      const [row] = await tx<{ id: number }[]>`
        insert into medications (family_id, child_id, name, dose_text, interval_minutes, first_dose_at, days, created_at)
        values (${session.familyId}, ${childId}, ${m.name}, ${m.doseText}, ${m.intervalMinutes}, ${m.firstDoseAt}, ${m.days}, ${Date.now()})
        returning id`;
      medMap.set(m.id, row.id);
    }
    const rows = data.doses.flatMap((d) => {
      const medicationId = medMap.get(d.medicationId);
      return medicationId
        ? [{ family_id: session.familyId, medication_id: medicationId, scheduled_at: d.scheduledAt, status: d.status, given_at: d.givenAt ?? null }]
        : [];
    });
    for (let i = 0; i < rows.length; i += 500) {
      await tx`insert into doses ${tx(rows.slice(i, i + 500), "family_id", "medication_id", "scheduled_at", "status", "given_at")}`;
    }
  });
}
