import { createHash, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./sql";
import { HttpError } from "./http";

const COOKIE = "lr_device";
const ONE_YEAR = 60 * 60 * 24 * 365;
// Sem 0/O/1/I/L para evitar confusão ao digitar o código.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface Session {
  deviceId: string;
  familyId: string;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function newCode(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** Aceita o código com ou sem hífens, em qualquer caixa. */
export function normalizeCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length === 12 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}` : "";
}

async function attachDevice(familyId: string, label: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into devices (family_id, token_hash, label, created_at)
    values (${familyId}, ${hash(token)}, ${label}, ${Date.now()})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/** Cria uma família nova (com um bebê inicial) e já conecta este aparelho a ela. */
export async function createFamily(label: string | null): Promise<string> {
  const code = newCode();
  const [family] = await sql<{ id: string }[]>`
    insert into families (code, created_at) values (${code}, ${Date.now()}) returning id`;
  await sql`
    insert into children (family_id, name, fill, created_at)
    values (${family.id}, 'Bebê 1', '#FFAFA3', ${Date.now()})`;
  await attachDevice(family.id, label);
  return code;
}

export async function joinFamily(rawCode: string, label: string | null): Promise<void> {
  const code = normalizeCode(rawCode);
  if (!code) throw new HttpError(400, "O código tem 12 letras e números.");
  const [family] = await sql<{ id: string }[]>`select id from families where code = ${code}`;
  // Mesma resposta para código inexistente, para não ajudar quem tenta adivinhar.
  if (!family) throw new HttpError(404, "Código não encontrado.");
  await attachDevice(family.id, label);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await sql<{ id: string; family_id: string }[]>`
    select id, family_id from devices where token_hash = ${hash(token)}`;
  return row ? { deviceId: row.id, familyId: row.family_id } : null;
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Entre com o código da família.");
  return session;
}

export async function leaveFamily(session: Session): Promise<void> {
  await sql`delete from devices where id = ${session.deviceId}`;
  (await cookies()).delete(COOKIE);
}
