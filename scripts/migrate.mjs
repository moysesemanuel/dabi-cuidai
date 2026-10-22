// Aplica db/schema.sql no banco apontado por DATABASE_URL. Seguro rodar mais de uma vez.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url && !process.env.PGDATABASE) {
  console.error("Defina DATABASE_URL (ou PGHOST/PGDATABASE/PGUSER). Ex.: npm run db:migrate");
  process.exit(1);
}
const options = { max: 1, onnotice: () => {} };
const sql = url ? postgres(url, options) : postgres(options);
await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
await sql.end();
console.log("Esquema aplicado.");
