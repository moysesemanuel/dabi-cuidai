import { requireSession } from "@/server/auth";
import { handle, HttpError, json, readJson } from "@/server/http";
import { sql } from "@/server/sql";

function parseSubscription(body: Record<string, unknown>) {
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const { endpoint } = body;
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    endpoint.length > 1000 ||
    typeof keys.p256dh !== "string" ||
    typeof keys.auth !== "string"
  ) {
    throw new HttpError(400, "Inscrição de aviso inválida.");
  }
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

/** Registra (ou atualiza) o aviso deste aparelho. Pode ser chamado a cada abertura do app. */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const sub = parseSubscription(await readJson(req));
    await sql`
      insert into push_subscriptions (device_id, endpoint, p256dh, auth, created_at)
      values (${session.deviceId}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth}, ${Date.now()})
      on conflict (endpoint) do update
        set device_id = excluded.device_id, p256dh = excluded.p256dh, auth = excluded.auth`;
    return json({ ok: true });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const { endpoint } = await readJson(req);
    if (typeof endpoint !== "string") throw new HttpError(400, "Inscrição inválida.");
    await sql`delete from push_subscriptions where endpoint = ${endpoint} and device_id = ${session.deviceId}`;
    return json({ ok: true });
  });
}
