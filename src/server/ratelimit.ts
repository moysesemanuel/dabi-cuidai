import { sql } from "./sql";
import { HttpError } from "./http";

/** IP de quem chamou. Na Vercel o x-forwarded-for traz o IP real do cliente. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
}

/**
 * Conta uma tentativa para `key` e recusa (429) quando passa de `max` dentro da janela.
 * Fica no banco porque cada chamada pode cair em uma instância diferente.
 */
export async function limit(key: string, max: number, windowMs: number, now = Date.now()): Promise<void> {
  const [row] = await sql<{ count: number }[]>`
    insert into rate_limits (key, window_start, count) values (${key}, ${now}, 1)
    on conflict (key) do update set
      window_start = case when rate_limits.window_start < ${now - windowMs} then ${now} else rate_limits.window_start end,
      count = case when rate_limits.window_start < ${now - windowMs} then 1 else rate_limits.count + 1 end
    returning count`;
  if (row.count > max) throw new HttpError(429, "Muitas tentativas. Espere um pouco e tente de novo.");
}

/** Apaga janelas antigas (chamado pelo vigia horário). */
export async function purgeLimits(now = Date.now()): Promise<void> {
  await sql`delete from rate_limits where window_start < ${now - 24 * 3_600_000}`;
}
