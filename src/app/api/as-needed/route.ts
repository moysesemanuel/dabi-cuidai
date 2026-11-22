import { requireSession } from "@/server/auth";
import { createAsNeeded, parseAsNeeded } from "@/server/asNeeded";
import { handle, json, readJson } from "@/server/http";

/** Cadastra um remédio "se necessário". */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    return json({ id: await createAsNeeded(session, parseAsNeeded(await readJson(req))) });
  });
}
