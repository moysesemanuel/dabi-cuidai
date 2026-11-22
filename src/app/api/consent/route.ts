import { acceptConsent, requireSession } from "@/server/auth";
import { handle, json, readJson } from "@/server/http";

/** Aceite dos termos e da política para um aparelho já conectado: `{ consent: { terms, privacy } }`. */
export async function POST(req: Request) {
  return handle(async () => {
    await acceptConsent(await requireSession(), (await readJson(req)).consent);
    return json({ ok: true });
  });
}
