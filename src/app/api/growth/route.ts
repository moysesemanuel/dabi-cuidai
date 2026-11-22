import { requireSession } from "@/server/auth";
import { createGrowth, listGrowth, parseGrowthInput } from "@/server/growth";
import { handle, HttpError, json, readJson } from "@/server/http";

/** Medições de uma criança: `?childId=`. */
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const childId = Number(new URL(req.url).searchParams.get("childId"));
    if (!Number.isSafeInteger(childId) || childId < 1) throw new HttpError(400, "Criança inválida.");
    return json({ measurements: await listGrowth(session, childId) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    return json({ id: await createGrowth(session, parseGrowthInput(await readJson(req))) });
  });
}
