import { requireSession } from "@/server/auth";
import { handle, idParam, json, readJson } from "@/server/http";
import { deleteMilestone, getMilestone, parseMilestoneInput, updateMilestone } from "@/server/milestones";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    return json({ milestone: await getMilestone(session, idParam((await params).id)) });
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await updateMilestone(session, idParam((await params).id), parseMilestoneInput(await readJson(req)));
    return json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await deleteMilestone(session, idParam((await params).id));
    return json({ ok: true });
  });
}
