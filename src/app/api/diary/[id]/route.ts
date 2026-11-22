import { requireSession } from "@/server/auth";
import { deleteHealthEntry, getHealthEntry, parseHealthEntry, updateHealthEntry } from "@/server/diary";
import { handle, idParam, json, readJson } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    return json({ entry: await getHealthEntry(session, idParam((await params).id)) });
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await updateHealthEntry(session, idParam((await params).id), parseHealthEntry(await readJson(req)));
    return json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await deleteHealthEntry(session, idParam((await params).id));
    return json({ ok: true });
  });
}
