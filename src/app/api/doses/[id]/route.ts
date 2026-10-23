import { after } from "next/server";
import { armDispatch } from "@/server/schedule";
import { requireSession } from "@/server/auth";
import { handle, HttpError, idParam, json, readJson } from "@/server/http";
import { setDoseGiven } from "@/server/repo";

type Ctx = { params: Promise<{ id: string }> };

/** Marca (given: true) ou desfaz (given: false) uma dose. */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { given } = await readJson(req);
    if (typeof given !== "boolean") throw new HttpError(400, "Parâmetro given inválido.");
    await setDoseGiven(session, idParam((await params).id), given);
    // Desfazer "Já dei" volta a dose para a fila de avisos.
    if (!given) after(() => armDispatch());
    return json({ ok: true });
  });
}
