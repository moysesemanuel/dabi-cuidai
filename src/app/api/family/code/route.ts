import { requireSession } from "@/server/auth";
import { rotateFamilyCode } from "@/server/family";
import { handle, json } from "@/server/http";
import { limit } from "@/server/ratelimit";

/** Troca o código da família. Os aparelhos já conectados continuam. */
export async function POST() {
  return handle(async () => {
    const session = await requireSession();
    await limit(`code:${session.familyId}`, 10, 3_600_000);
    return json({ code: await rotateFamilyCode(session) });
  });
}
