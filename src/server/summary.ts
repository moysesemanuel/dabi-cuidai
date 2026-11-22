import { parseCivilDate } from "@/lib/age";
import type { SummaryData } from "@/lib/summary";
import type { Session } from "./auth";
import { listHealthEntries } from "./diary";
import { listGrowth } from "./growth";
import { HttpError } from "./http";
import { listMilestones } from "./milestones";
import { getDoseHistory, parseHistoryQuery } from "./repo";

export interface SummaryQuery {
  childId: number;
  /** Começo e fim do período no relógio do aparelho (epoch ms), para registros e doses. */
  from: number;
  to: number;
  /** As mesmas datas no calendário, para medições e marcos (que são datas civis). */
  fromDate: string;
  toDate: string;
}

export function parseSummaryQuery(params: URLSearchParams, now = Date.now()): SummaryQuery {
  const { childId, from, to } = parseHistoryQuery(params, now);
  if (childId === undefined) throw new HttpError(400, "Escolha a criança.");
  const fromDate = params.get("fromDate") ?? "";
  const toDate = params.get("toDate") ?? "";
  if (!parseCivilDate(fromDate) || !parseCivilDate(toDate) || fromDate > toDate) throw new HttpError(400, "Período inválido.");
  return { childId, from, to, fromDate, toDate };
}

/** Tudo de uma criança no período. Cada leitura já confere que a criança é da família. */
export async function getSummaryData(session: Session, q: SummaryQuery): Promise<SummaryData> {
  const [entries, doses, growth, milestones] = await Promise.all([
    listHealthEntries(session, { childId: q.childId, from: q.from, to: q.to }),
    getDoseHistory(session, { childId: q.childId, from: q.from, to: q.to }),
    listGrowth(session, q.childId),
    listMilestones(session, q.childId),
  ]);
  const before = growth.filter((m) => m.measuredOn < q.fromDate).at(-1);
  return {
    entries,
    doses,
    // A última medição de antes do período entra só como referência para a variação.
    growth: [...(before ? [before] : []), ...growth.filter((m) => m.measuredOn >= q.fromDate && m.measuredOn <= q.toDate)],
    milestones: milestones.filter((m) => m.happenedOn >= q.fromDate.slice(0, m.precision === "day" ? 10 : 7) && m.happenedOn <= q.toDate),
  };
}
