import { leaveFamily, requireSession } from "@/server/auth";
import { handle, json } from "@/server/http";

/** Desconecta só este aparelho; os dados e os outros aparelhos continuam. */
export async function POST() {
  return handle(async () => {
    await leaveFamily(await requireSession());
    return json({ ok: true });
  });
}
