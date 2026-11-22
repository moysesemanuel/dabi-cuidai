import { requireSession } from "@/server/auth";
import { parseAsNeeded, updateAsNeeded } from "@/server/asNeeded";
import { handle, idParam, json, readJson } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Edita um remédio "se necessário". Remover usa a rota comum de remédios (DELETE /api/medications/[id]). */
export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await updateAsNeeded(session, idParam((await params).id), parseAsNeeded(await readJson(req)));
    return json({ ok: true });
  });
}
