import { joinFamily } from "@/server/auth";
import { handle, json, readJson } from "@/server/http";
import { clientIp, limit } from "@/server/ratelimit";

export async function POST(req: Request) {
  return handle(async () => {
    await limit(`join:${clientIp(req)}`, 30, 3_600_000);
    const body = await readJson(req);
    await joinFamily(typeof body.code === "string" ? body.code : "", null);
    return json({ ok: true });
  });
}
