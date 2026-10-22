import { joinFamily } from "@/server/auth";
import { handle, json, readJson } from "@/server/http";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    await joinFamily(typeof body.code === "string" ? body.code : "", null);
    return json({ ok: true });
  });
}
