import { requireSession } from "@/server/auth";
import { handle, HttpError, json, readJson } from "@/server/http";
import { createMilestone, listMilestones, parseMilestoneInput } from "@/server/milestones";

/** Marcos de uma criança: `?childId=`. */
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const childId = Number(new URL(req.url).searchParams.get("childId"));
    if (!Number.isSafeInteger(childId) || childId < 1) throw new HttpError(400, "Criança inválida.");
    return json({ milestones: await listMilestones(session, childId) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    return json({ id: await createMilestone(session, parseMilestoneInput(await readJson(req))) });
  });
}
