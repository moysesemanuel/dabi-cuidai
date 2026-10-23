import { after } from "next/server";
import { armDispatch } from "@/server/schedule";
import { requireSession } from "@/server/auth";
import { handle, HttpError, idParam, json, readJson } from "@/server/http";
import { deleteMedication, parseMedication, updateMedication } from "@/server/repo";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const body = await readJson(req);
    const from = body.from;
    const now = Date.now();
    if (typeof from !== "number" || !Number.isFinite(from) || Math.abs(from - now) > 2 * 86_400_000) {
      throw new HttpError(400, "Parâmetro from inválido.");
    }
    await updateMedication(session, idParam((await params).id), parseMedication(body), from);
    after(() => armDispatch());
    return json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await deleteMedication(session, idParam((await params).id));
    return json({ ok: true });
  });
}
