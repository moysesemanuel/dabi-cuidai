import { requireSession } from "@/server/auth";
import { handle, json } from "@/server/http";
import { getSummaryData, parseSummaryQuery } from "@/server/summary";

/** Dados do resumo: `?childId=&from=&to=&fromDate=AAAA-MM-DD&toDate=AAAA-MM-DD`. */
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    return json(await getSummaryData(session, parseSummaryQuery(new URL(req.url).searchParams)));
  });
}
