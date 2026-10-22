import { requireSession } from "@/server/auth";
import { handle, json, readJson } from "@/server/http";
import { createMedication, parseMedication } from "@/server/repo";

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const id = await createMedication(session, parseMedication(await readJson(req)));
    return json({ id }, { status: 201 });
  });
}
