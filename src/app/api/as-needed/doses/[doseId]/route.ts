import { requireSession } from "@/server/auth";
import { deleteAsNeededDose } from "@/server/asNeeded";
import { handle, idParam, json } from "@/server/http";

type Ctx = { params: Promise<{ doseId: string }> };

/** Apaga uma dose registrada por engano (só de remédios "se necessário"). */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await deleteAsNeededDose(await requireSession(), idParam((await params).doseId));
    return json({ ok: true });
  });
}
