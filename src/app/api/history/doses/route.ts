import { requireSession } from "@/server/auth";
import { handle, json } from "@/server/http";
import { getDoseHistory, parseHistoryQuery } from "@/server/repo";

/** Histórico de doses da família: `?childId=&from=&to=` (epoch ms; padrão: últimos 30 dias). */
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const query = parseHistoryQuery(new URL(req.url).searchParams);
    return json({ doses: await getDoseHistory(session, query) });
  });
}
