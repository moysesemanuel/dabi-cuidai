import { requireSession } from "@/server/auth";
import { handle, json, readJson } from "@/server/http";
import { setDeviceName } from "@/server/repo";

/** Só este aparelho: `{ name }` é o nome de quem usa, mostrado na saudação. */
export async function PATCH(req: Request) {
  return handle(async () => {
    await setDeviceName(await requireSession(), await readJson(req));
    return json({ ok: true });
  });
}
