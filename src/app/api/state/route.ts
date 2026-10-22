import { requireSession } from "@/server/auth";
import { handle, HttpError, json } from "@/server/http";
import { getState } from "@/server/repo";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const dayStart = Number(new URL(req.url).searchParams.get("dayStart"));
    const now = Date.now();
    // O começo do dia vem do aparelho (fuso horário dele); aceita só valores plausíveis.
    if (!Number.isFinite(dayStart) || Math.abs(dayStart - now) > 2 * 86_400_000) {
      throw new HttpError(400, "Parâmetro dayStart inválido.");
    }
    return json(await getState(session, dayStart));
  });
}
