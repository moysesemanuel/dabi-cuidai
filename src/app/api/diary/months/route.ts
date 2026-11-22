import { requireSession } from "@/server/auth";
import { diaryMonths, parseTimeZone } from "@/server/diary";
import { handle, HttpError, json } from "@/server/http";

/** Índice do Diário por mês: `?tz=America/Sao_Paulo&childId=`. */
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const params = new URL(req.url).searchParams;
    const raw = params.get("childId");
    const childId = raw ? Number(raw) : undefined;
    if (childId !== undefined && (!Number.isSafeInteger(childId) || childId < 1)) throw new HttpError(400, "Criança inválida.");
    return json({ months: await diaryMonths(session, childId, parseTimeZone(params.get("tz"))) });
  });
}
