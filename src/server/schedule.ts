import { Client } from "@upstash/qstash";
import { MAX_LATE_MS, MAX_REPEATS, REPEAT_EVERY_MS } from "./dispatch";
import { sql } from "./sql";

/** Folga mínima antes de a mensagem chegar, para a execução atual terminar de gravar. */
const MIN_AHEAD_MS = 5_000;
/** Mais longe que isso a mensagem só seria útil como rede de segurança; o vigia da hora seguinte cobre. */
const MAX_AHEAD_MS = 23 * 3_600_000;

/** Instante da próxima mensagem do QStash, ou null se não há nada a avisar. */
export function nextTarget(eventAt: number | null, now: number): number | null {
  if (eventAt === null) return null;
  return Math.min(Math.max(eventAt, now + MIN_AHEAD_MS), now + MAX_AHEAD_MS);
}

/** Quando a próxima dose pendente precisa de aviso (primeiro aviso ou repetição). */
async function nextEventAt(now: number): Promise<number | null> {
  const [row] = await sql<{ at: number | null }[]>`
    select min(case when notified_count = 0 then scheduled_at else last_notified_at + ${REPEAT_EVERY_MS} end) as at
    from doses
    where status = 'pending'
      and scheduled_at > ${now - MAX_LATE_MS}
      and notified_count <= ${MAX_REPEATS}`;
  return row?.at ?? null;
}

function appUrl(): string | null {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : null;
}

/**
 * Pede ao QStash uma chamada de /api/cron/dispatch na hora do próximo aviso. Cada execução arma a seguinte,
 * então o banco só é consultado quando há algo a avisar. Chamar várias vezes é seguro: o id de
 * deduplicação é o próprio horário, e quem chega antes ou depois do horário só encontra o que já foi avisado.
 * Sem QSTASH_TOKEN (desenvolvimento) não faz nada; o vigia horário do QStash cobre falhas aqui.
 */
export async function armDispatch(now = Date.now()): Promise<void> {
  const url = appUrl();
  if (!process.env.QSTASH_TOKEN || !url) return;
  try {
    const target = nextTarget(await nextEventAt(now), now);
    if (target === null) return;
    const seconds = Math.ceil(target / 1000);
    await new Client().publishJSON({
      url: `${url}/api/cron/dispatch`,
      body: {},
      notBefore: seconds,
      deduplicationId: `dispatch-${seconds}`,
      retries: 3,
    });
  } catch (err) {
    console.error("não consegui armar o próximo aviso", err instanceof Error ? err.message : err);
  }
}
