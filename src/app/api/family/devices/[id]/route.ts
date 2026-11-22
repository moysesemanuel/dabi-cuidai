import { requireSession } from "@/server/auth";
import { removeDevice } from "@/server/family";
import { handle, json } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Desconecta outro aparelho da família. */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await removeDevice(await requireSession(), (await params).id);
    return json({ ok: true });
  });
}
