import { requireSession } from "@/server/auth";
import { handle, idParam, json, readJson } from "@/server/http";
import { deleteChild, updateChild } from "@/server/repo";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await updateChild(session, idParam((await params).id), await readJson(req));
    return json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await deleteChild(session, idParam((await params).id));
    return json({ ok: true });
  });
}
