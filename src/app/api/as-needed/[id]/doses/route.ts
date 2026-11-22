import { requireSession } from "@/server/auth";
import { listAsNeededDoses, parseAsNeededDose, registerAsNeededDose } from "@/server/asNeeded";
import { handle, idParam, json, readJson } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Últimas doses registradas desse remédio. */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    return json({ doses: await listAsNeededDoses(session, idParam((await params).id)) });
  });
}

/** Registra uma dose dada: `{ givenAt, reason, temperature }`. */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const id = await registerAsNeededDose(session, idParam((await params).id), parseAsNeededDose(await readJson(req)));
    return json({ id });
  });
}
