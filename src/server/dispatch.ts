import { fmtDuration } from "@/lib/format";
import { sendToFamily, type PushPayload, type SendResult } from "./push";
import { sql } from "./sql";

/** Depois de quantos minutos sem "Já dei" o lembrete é repetido. */
export const REPEAT_EVERY_MS = 10 * 60_000;
/** Quantas repetições depois do primeiro aviso (≈ 1 hora de insistência). */
export const MAX_REPEATS = 6;
/** Doses mais atrasadas que isso não geram aviso novo (continuam "atrasadas" na tela). */
export const MAX_LATE_MS = 3 * 3_600_000;

export interface DueDose {
  id: number;
  familyId: string;
  scheduledAt: number;
  notifiedCount: number;
  childName: string;
  medName: string;
  doseText: string;
}

/** Texto do aviso. O primeiro é "hora de dar"; os seguintes dizem há quanto tempo está atrasado. */
export function buildMessage(d: DueDose, now: number): PushPayload {
  const late = now - d.scheduledAt;
  const first = d.notifiedCount === 0;
  const detail = d.doseText ? ` · ${d.doseText}` : "";
  return {
    title: first ? `Hora do remédio: ${d.childName}` : `Atrasado: ${d.childName}`,
    body: first
      ? `${d.medName}${detail}`
      : `${d.medName}${detail} — faz ${fmtDuration(Math.max(1, Math.round(late / 60_000)))}. Toque em "Já dei" quando der.`,
    tag: `dose-${d.id}`,
    url: "/",
    doseId: d.id,
  };
}

export interface DispatchSummary {
  due: number;
  sent: number;
  failed: number;
  removed: number;
}

/**
 * Procura as doses vencidas e avisa a família inteira. Cada dose é "reservada" no banco antes do envio,
 * então duas execuções ao mesmo tempo nunca mandam o mesmo aviso duas vezes.
 */
export async function dispatchDue(now = Date.now()): Promise<DispatchSummary> {
  const claimed = await sql<
    { id: number; family_id: string; scheduled_at: number; notified_count: number; child_name: string; med_name: string; dose_text: string }[]
  >`
    with due as (
      select d.id from doses d
      where d.status = 'pending'
        and d.scheduled_at <= ${now}
        and d.scheduled_at > ${now - MAX_LATE_MS}
        and (
          d.notified_count = 0
          or (d.notified_count <= ${MAX_REPEATS} and d.last_notified_at <= ${now - REPEAT_EVERY_MS})
        )
      for update skip locked
    ),
    claimed as (
      update doses set notified_count = notified_count + 1, last_notified_at = ${now}
      where id in (select id from due)
      returning id, family_id, medication_id, scheduled_at, notified_count - 1 as notified_count
    )
    select c.id, c.family_id, c.scheduled_at, c.notified_count,
           ch.name as child_name, m.name as med_name, m.dose_text
    from claimed c
    join medications m on m.id = c.medication_id
    join children ch on ch.id = m.child_id
    order by c.scheduled_at`;

  const summary: DispatchSummary = { due: claimed.length, sent: 0, failed: 0, removed: 0 };
  for (const row of claimed) {
    const result: SendResult = await sendToFamily(
      row.family_id,
      buildMessage(
        {
          id: row.id,
          familyId: row.family_id,
          scheduledAt: row.scheduled_at,
          notifiedCount: row.notified_count,
          childName: row.child_name,
          medName: row.med_name,
          doseText: row.dose_text,
        },
        now,
      ),
    );
    summary.sent += result.sent;
    summary.failed += result.failed;
    summary.removed += result.removed;
  }
  return summary;
}
