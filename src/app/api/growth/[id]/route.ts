import { requireSession } from "@/server/auth";
import { deleteGrowth, getGrowth, parseGrowthInput, updateGrowth } from "@/server/growth";
import { handle, idParam, json, readJson } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    return json({ measurement: await getGrowth(session, idParam((await params).id)) });
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await updateGrowth(session, idParam((await params).id), parseGrowthInput(await readJson(req)));
    return json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await deleteGrowth(session, idParam((await params).id));
    return json({ ok: true });
  });
}
