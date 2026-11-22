import { createHash, randomBytes, randomInt } from "node:crypto";
import { cookies, headers } from "next/headers";
import { describeDevice } from "@/lib/device";
import { consentIsCurrent, CURRENT_CONSENT, type ConsentVersions } from "@/lib/legal";
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

export function newCode(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** Aceita o código com ou sem hífens, em qualquer caixa. */
export function normalizeCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length === 12 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}` : "";
}

/**
 * Confere o aceite enviado pelo aparelho: precisa ser das versões atuais dos termos e da política.
 * Sem isso, não cria família nem entra em uma.
 */
export function parseConsent(value: unknown): ConsentVersions {
  const v = value as Partial<ConsentVersions> | null | undefined;
  if (!consentIsCurrent(v)) throw new HttpError(400, "Para continuar, aceite os termos de uso e a política de privacidade.");
  return { ...CURRENT_CONSENT };
}

async function attachDevice(familyId: string, label: string | null, consent: ConsentVersions): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const info = describeDevice((await headers()).get("user-agent"));
  const now = Date.now();
  await sql`
    insert into devices (family_id, token_hash, label, device_info, created_at, terms_version, privacy_version, consent_at)
    values (${familyId}, ${hash(token)}, ${label}, ${info}, ${now}, ${consent.terms}, ${consent.privacy}, ${now})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/** Cria uma família nova (com uma criança inicial) e já conecta este aparelho a ela. */
export async function createFamily(label: string | null, consent: ConsentVersions): Promise<string> {
  const code = newCode();
  const [family] = await sql<{ id: string }[]>`
    insert into families (code, created_at) values (${code}, ${Date.now()}) returning id`;
  await sql`
    insert into children (family_id, name, fill, created_at)
    values (${family.id}, 'Criança 1', '#FFAFA3', ${Date.now()})`;
  await attachDevice(family.id, label, consent);
  return code;
}

export async function joinFamily(rawCode: string, label: string | null, consent: ConsentVersions): Promise<void> {
  const code = normalizeCode(rawCode);
  if (!code) throw new HttpError(400, "O código tem 12 letras e números.");
  const [family] = await sql<{ id: string }[]>`select id from families where code = ${code}`;
  // Mesma resposta para código inexistente, para não ajudar quem tenta adivinhar.
  if (!family) throw new HttpError(404, "Código não encontrado.");
  await attachDevice(family.id, label, consent);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const now = Date.now();
  const info = describeDevice((await headers()).get("user-agent"));
  // Registra o último acesso (e o tipo de aparelho) no máximo uma vez por hora, na mesma ida ao banco.
  const [row] = await sql<{ id: string; family_id: string }[]>`
    with s as (select id, family_id, last_seen_at from devices where token_hash = ${hash(token)}),
    touch as (
      update devices set last_seen_at = ${now}, device_info = coalesce(${info}, devices.device_info) from s
      where devices.id = s.id
        and (s.last_seen_at is null or s.last_seen_at < ${now - 3_600_000} or (devices.device_info is null and ${info}::text is not null))
      returning devices.id
    )
    select id, family_id from s`;
  return row ? { deviceId: row.id, familyId: row.family_id } : null;
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Entre com o código da família.");
  return session;
}

/** Registra o aceite das versões atuais para um aparelho que já estava conectado. */
export async function acceptConsent(session: Session, value: unknown, now = Date.now()): Promise<void> {
  const consent = parseConsent(value);
  await sql`
    update devices set terms_version = ${consent.terms}, privacy_version = ${consent.privacy}, consent_at = ${now}
    where id = ${session.deviceId}`;
}

export async function leaveFamily(session: Session): Promise<void> {
  await sql`delete from devices where id = ${session.deviceId}`;
  await clearSessionCookie();
}

/** Tira a sessão deste navegador (depois de sair da família ou de excluir os dados). */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
