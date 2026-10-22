import postgres from "postgres";

const options = {
  max: 5,
  // Compatível com o pooler do Neon (PgBouncer em modo transação).
  prepare: false,
  // Datas e ids são bigint; no app são números comuns (cabem com folga em 2^53).
  types: {
    bigint: {
      to: 20,
      from: [20],
      parse: (value: string) => Number(value),
      serialize: (value: number) => String(value),
    },
  },
};

const globalForSql = globalThis as unknown as { __sql?: postgres.Sql };

/** Em produção usa DATABASE_URL; em desenvolvimento, as variáveis PG* (ver .env.local). */
export const sql: postgres.Sql =
  globalForSql.__sql ??
  (globalForSql.__sql = process.env.DATABASE_URL
    ? postgres(process.env.DATABASE_URL, options)
    : postgres(options));
