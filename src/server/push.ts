import webpush from "web-push";
import { sql } from "./sql";

export interface PushPayload {
  title: string;
  body: string;
  /** Mesma tag = a notificação nova substitui a anterior (os lembretes repetidos não empilham). */
  tag: string;
  url: string;
  doseId?: number;
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contato@example.com", publicKey, privateKey);
  configured = true;
  return true;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  removed: number;
}

async function sendTo(subs: SubRow[], payload: PushPayload): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, removed: 0 };
  if (!configure()) return { ...result, failed: subs.length };
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        // Urgency alta: o sistema tenta entregar já, mesmo com o celular em economia de bateria.
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60,
          urgency: "high",
        });
        result.sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Inscrição expirada ou removida pelo usuário: não adianta insistir.
          await sql`delete from push_subscriptions where id = ${s.id}`;
          result.removed++;
        } else {
          result.failed++;
          console.error("push falhou", status ?? (err as Error).message);
        }
      }
    }),
  );
  return result;
}

export async function sendToFamily(familyId: string, payload: PushPayload): Promise<SendResult> {
  const subs = await sql<SubRow[]>`
    select s.id, s.endpoint, s.p256dh, s.auth
    from push_subscriptions s join devices d on d.id = s.device_id
    where d.family_id = ${familyId}`;
  return sendTo(subs, payload);
}

export async function sendToDevice(deviceId: string, payload: PushPayload): Promise<SendResult> {
  const subs = await sql<SubRow[]>`
    select id, endpoint, p256dh, auth from push_subscriptions where device_id = ${deviceId}`;
  return sendTo(subs, payload);
}
