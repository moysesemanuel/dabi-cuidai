import { after } from "next/server";
import { armDispatch } from "@/server/schedule";
import { requireSession } from "@/server/auth";
import { handle, json, readJson } from "@/server/http";
import { importLocal, parseImport } from "@/server/repo";

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    await importLocal(session, parseImport(await readJson(req)));
    after(() => armDispatch());
    return json({ ok: true });
  });
}
