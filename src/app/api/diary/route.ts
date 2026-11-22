import { requireSession } from "@/server/auth";
import { createHealthEntry, listHealthEntries, parseHealthEntry } from "@/server/diary";
import { handle, json, readJson } from "@/server/http";
import { parseHistoryQuery } from "@/server/repo";

/** Registros do diário: `?childId=&from=&to=` (epoch ms; padrão: últimos 30 dias). */
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const query = parseHistoryQuery(new URL(req.url).searchParams);
    return json({ entries: await listHealthEntries(session, query) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const id = await createHealthEntry(session, parseHealthEntry(await readJson(req)));
    return json({ id });
  });
}
