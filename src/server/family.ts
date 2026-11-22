import { clearSessionCookie, newCode, type Session } from "./auth";
import { HttpError } from "./http";
import { sql } from "./sql";

export interface DeviceInfo {
  id: string;
  /** Nome de quem usa ("Ana"), se a pessoa colocou no Perfil. */
  name?: string;
  /** "iPhone · Safari". */
  kind?: string;
  connectedAt: number;
  lastSeenAt?: number;
  /** É o aparelho que está fazendo a consulta. */
  current: boolean;
  /** Recebe os avisos dos remédios. */
  push: boolean;
}

/** Aparelhos conectados à família, do mais recente para o mais antigo. */
export async function listDevices(session: Session): Promise<DeviceInfo[]> {
  const rows = await sql<
    { id: string; label: string | null; device_info: string | null; created_at: number; last_seen_at: number | null; push: boolean }[]
  >`
    select d.id, d.label, d.device_info, d.created_at, d.last_seen_at,
           exists (select 1 from push_subscriptions p where p.device_id = d.id) as push
    from devices d where d.family_id = ${session.familyId}
    order by coalesce(d.last_seen_at, d.created_at) desc`;
  return rows.map((r) => ({
    id: r.id,
    name: r.label ?? undefined,
    kind: r.device_info ?? undefined,
    connectedAt: r.created_at,
    lastSeenAt: r.last_seen_at ?? undefined,
    current: r.id === session.deviceId,
    push: r.push,
  }));
}

/** Desconecta outro aparelho da família. Ele perde o acesso na hora e para de receber avisos. */
export async function removeDevice(session: Session, deviceId: string): Promise<void> {
  if (deviceId === session.deviceId) throw new HttpError(400, "Para este celular, use \"Sair da família\".");
  // O id vem da URL: só um uuid válido chega ao banco.
  if (!/^[0-9a-f-]{36}$/i.test(deviceId)) throw new HttpError(404, "Aparelho não encontrado.");
  const rows = await sql`delete from devices where id = ${deviceId} and family_id = ${session.familyId} returning id`;
  if (!rows.length) throw new HttpError(404, "Aparelho não encontrado.");
}

/**
 * Troca o código da família. Os aparelhos já conectados continuam (cada um tem a sua sessão);
 * o código antigo deixa de servir para entrar.
 */
export async function rotateFamilyCode(session: Session, now = Date.now()): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      await sql`update families set code = ${code}, code_changed_at = ${now} where id = ${session.familyId}`;
      return code;
    } catch (err) {
      // Colisão com o código de outra família (raríssimo): tenta outro.
      if ((err as { code?: string }).code !== "23505") throw err;
    }
  }
  throw new HttpError(500, "Não foi possível gerar um código novo. Tente de novo.");
}

/** Palavra que a pessoa digita para confirmar a exclusão. */
export const DELETE_CONFIRMATION = "EXCLUIR";

/** Apaga a família inteira: crianças, remédios, doses, diário, medições, marcos, fotos e todos os aparelhos. */
export async function deleteFamily(session: Session, confirmation: unknown): Promise<void> {
  if (typeof confirmation !== "string" || confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION) {
    throw new HttpError(400, `Digite ${DELETE_CONFIRMATION} para confirmar.`);
  }
  await sql`delete from families where id = ${session.familyId}`;
  await clearSessionCookie();
}

/**
 * Cópia de tudo o que a família guardou, para levar ou conferir. Fica de fora o que é segredo
 * (sessões, inscrições de aviso) e o próprio código de entrada.
 */
export async function exportFamily(session: Session, now = Date.now()) {
  const f = session.familyId;
  const [family] = await sql<{ created_at: number }[]>`select created_at from families where id = ${f}`;
  const [children, medications, doses, diary, growth, milestones, devices] = await Promise.all([
    sql<{ id: number; photo: Buffer | null; photo_type: string | null }[]>`
      select id, name, fill as color, birth_date::text as birth_date, premature, ga_weeks, ga_days, photo, photo_type, created_at
      from children where family_id = ${f} order by id`,
    sql`select id, child_id, kind, name, dose_text, instructions, interval_minutes, first_dose_at, days, created_at, deleted_at
        from medications where family_id = ${f} order by id`,
    sql`select id, medication_id, child_id, med_name, dose_text, interval_minutes, scheduled_at, status, given_at, reason, temp_tenths
        from doses where family_id = ${f} order by scheduled_at`,
    sql`select id, child_id, occurred_at, temp_tenths, symptoms, note, created_at, updated_at
        from health_entries where family_id = ${f} order by occurred_at`,
    sql`select id, child_id, measured_on::text as measured_on, weight_g, length_mm, note, created_at
        from growth_measurements where family_id = ${f} order by measured_on`,
    sql`select id, child_id, title, happened_on::text as happened_on, date_precision, category, note, created_at
        from milestones where family_id = ${f} order by happened_on`,
    sql`select label as name, device_info as kind, created_at, last_seen_at from devices where family_id = ${f} order by created_at`,
  ]);
  const iso = (ms: unknown) => (typeof ms === "number" ? new Date(ms).toISOString() : null);
  return {
    app: "Cuidaí Kids",
    format: 1,
    exportedAt: new Date(now).toISOString(),
    familyCreatedAt: iso(family?.created_at),
    note: "Dados registrados pela família. Datas e horários em UTC (ISO 8601); datas de calendário como AAAA-MM-DD.",
    children: children.map(({ photo, photo_type, ...c }) => ({
      ...c,
      created_at: iso((c as Record<string, unknown>).created_at),
      photo: photo && photo_type ? `data:${photo_type};base64,${photo.toString("base64")}` : null,
    })),
    medications: medications.map((m) => ({
      ...m,
      first_dose_at: iso(m.first_dose_at),
      created_at: iso(m.created_at),
      deleted_at: iso(m.deleted_at),
    })),
    doses: doses.map(({ temp_tenths, ...d }) => ({
      ...d,
      temperature_c: temp_tenths === null ? null : Number(temp_tenths) / 10,
      scheduled_at: iso(d.scheduled_at),
      given_at: iso(d.given_at),
    })),
    diary: diary.map(({ temp_tenths, ...e }) => ({
      ...e,
      temperature_c: temp_tenths === null ? null : Number(temp_tenths) / 10,
      occurred_at: iso(e.occurred_at),
      created_at: iso(e.created_at),
      updated_at: iso(e.updated_at),
    })),
    growth: growth.map((g) => ({ ...g, created_at: iso(g.created_at) })),
    milestones: milestones.map((m) => ({ ...m, created_at: iso(m.created_at) })),
    devices: devices.map((d) => ({ ...d, created_at: iso(d.created_at), last_seen_at: iso(d.last_seen_at) })),
  };
}
