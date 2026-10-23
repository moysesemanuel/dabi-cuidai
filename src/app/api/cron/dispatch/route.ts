import { timingSafeEqual } from "node:crypto";
import { Receiver } from "@upstash/qstash";
import { dispatchDue } from "@/server/dispatch";
import { handle, HttpError, json } from "@/server/http";
import { purgeLimits } from "@/server/ratelimit";
import { armDispatch } from "@/server/schedule";

function validSecret(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function validQStash(req: Request, body: string): Promise<boolean> {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  const signature = req.headers.get("upstash-signature");
  if (!current || !next || !signature) return false;
  try {
    return await new Receiver({ currentSigningKey: current, nextSigningKey: next }).verify({ signature, body });
  } catch {
    return false;
  }
}

/** Chamado pelo QStash na hora de cada aviso e uma vez por hora (ou à mão, com CRON_SECRET). Só aceita chamadas autenticadas. */
async function run(req: Request) {
  return handle(async () => {
    const body = await req.text();
    if (!validSecret(req.headers.get("authorization")) && !(await validQStash(req, body))) {
      throw new HttpError(401, "Não autorizado.");
    }
    const summary = await dispatchDue();
    if (summary.due > 0) console.log("dispatch", JSON.stringify(summary));
    // Arma a próxima chamada e aproveita o vigia horário para limpar contadores antigos.
    await armDispatch();
    await purgeLimits().catch(() => {});
    return json(summary);
  });
}

export const POST = run;
export const GET = run;
