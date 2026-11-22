import { timingSafeEqual } from "node:crypto";
import {
  HUB_CONTRACT_VERSION,
  type HubHealth,
  type HubHealthCheck,
  type HubMetric,
  type HubOverview,
  type HubStatus,
} from "@/lib/hub/hub-contract";
import { MAX_LATE_MS } from "./dispatch";
import { sql } from "./sql";

/** Slug do sistema no registro do Dabi Hub (`dabi-hub/src/lib/projects.ts`). */
export const HUB_SYSTEM = "dabi-cuidai";

const DAY = 86_400_000;
/** Uma dose vencida há mais que isso sem nenhum aviso indica que o agendamento dos avisos parou. */
const DISPATCH_GRACE_MS = 10 * 60_000;
const CHECK_TIMEOUT_MS = 3_000;

/**
 * Autorização do hub: só `Authorization: Bearer <DABI_HUB_TOKEN>`, comparado em tempo constante.
 * Sem segredo configurado (ou curto demais) responde 503; token errado, 401.
 */
export function hubAuthError(req: Request): Response | null {
  const secret = process.env.DABI_HUB_TOKEN;
  if (!secret || secret.length < 32) return hubJson({ error: "Hub não configurado." }, 503);
  const header = req.headers.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return hubJson({ error: "Não autorizado." }, 401);
  }
  return null;
}

export const hubJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function timed(name: string, fn: () => Promise<string | undefined>): Promise<HubHealthCheck> {
  const started = performance.now();
  try {
    const detail = await fn();
    return { name, status: "ok", latencyMs: Math.round(performance.now() - started), detail };
  } catch (err) {
    return {
      name,
      status: "fail",
      latencyMs: Math.round(performance.now() - started),
      detail: err instanceof Error ? err.message : "falhou",
    };
  }
}

/** O token do QStash é aceito? Foi um token inválido que deixou os avisos só na hora cheia. Não gasta mensagens. */
async function checkScheduler(): Promise<string | undefined> {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN ausente: avisos só pelo vigia horário");
  const base = (process.env.QSTASH_URL ?? "https://qstash.upstash.io").replace(/\/$/, "");
  const res = await fetch(`${base}/v2/schedules`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new Error("QStash recusou o token: avisos só pelo vigia horário");
  if (!res.ok) throw new Error(`QStash respondeu HTTP ${res.status}`);
  return undefined;
}

/** Doses que já deviam ter sido avisadas e não foram: o sintoma direto de agendamento parado. */
async function checkDispatch(now: number): Promise<string | undefined> {
  const [row] = await sql<{ late: number }[]>`
    select count(*)::bigint as late from doses d
    join medications m on m.id = d.medication_id and m.deleted_at is null
    where d.status = 'pending' and d.notified_count = 0
      and d.scheduled_at <= ${now - DISPATCH_GRACE_MS} and d.scheduled_at > ${now - MAX_LATE_MS}`;
  if (row.late > 0) throw new Error(`${row.late} dose(s) vencida(s) há mais de 10 min sem aviso`);
  return undefined;
}

export async function getHubHealth(): Promise<HubHealth> {
  const now = Date.now();
  const database = await timed("database", async () => {
    await sql`select 1`;
    return undefined;
  });
  const checks: HubHealthCheck[] = [database];
  checks.push(
    await timed("push", async () => {
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) throw new Error("chaves VAPID ausentes");
      return undefined;
    }),
  );
  checks.push(await timed("scheduler", checkScheduler));
  if (database.status === "ok") checks.push(await timed("dispatch", () => checkDispatch(now)));

  const status: HubStatus =
    database.status === "fail" ? "down" : checks.some((c) => c.status === "fail") ? "degraded" : "ok";
  return {
    contract: HUB_CONTRACT_VERSION,
    system: HUB_SYSTEM,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    status,
    checks,
    generatedAt: new Date(now).toISOString(),
  };
}

/** Só números agregados: nenhum nome, código de família ou dado de criança sai daqui. */
export async function getHubOverview(): Promise<HubOverview> {
  const now = Date.now();
  const [r] = await sql<
    {
      families: number;
      active_families: number;
      new_families: number;
      devices: number;
      push_devices: number;
      children: number;
      photos: number;
      active_meds: number;
      doses_24h: number;
      given_24h: number;
      missed_24h: number;
      notified_24h: number;
    }[]
  >`
    select
      (select count(*) from families)::bigint as families,
      (select count(distinct family_id) from devices where last_seen_at > ${now - 30 * DAY})::bigint as active_families,
      (select count(*) from families where created_at > ${now - 30 * DAY})::bigint as new_families,
      (select count(*) from devices)::bigint as devices,
      (select count(distinct device_id) from push_subscriptions)::bigint as push_devices,
      (select count(*) from children)::bigint as children,
      (select count(*) from children where photo_version is not null)::bigint as photos,
      (select count(*) from medications
        where deleted_at is null and first_dose_at <= ${now} and first_dose_at + days * ${DAY}::bigint > ${now})::bigint as active_meds,
      (select count(*) from doses where scheduled_at > ${now - DAY} and scheduled_at <= ${now})::bigint as doses_24h,
      (select count(*) from doses
        where scheduled_at > ${now - DAY} and scheduled_at <= ${now} and status = 'given')::bigint as given_24h,
      (select count(*) from doses
        where scheduled_at > ${now - DAY} and scheduled_at <= ${now - MAX_LATE_MS} and status = 'pending')::bigint as missed_24h,
      (select coalesce(sum(notified_count), 0) from doses where last_notified_at > ${now - DAY})::bigint as notified_24h`;

  const adherence = r.doses_24h > 0 ? Math.round((r.given_24h / r.doses_24h) * 1000) / 10 : null;
  const metrics: HubMetric[] = [
    { key: "devices", label: "Celulares conectados", value: r.devices, format: "number" },
    {
      key: "push-devices",
      label: "Celulares com avisos",
      value: r.push_devices,
      format: "number",
      hint: "inscritos no push",
      attention: r.devices > 0 && r.push_devices === 0,
    },
    { key: "children", label: "Crianças", value: r.children, format: "number", hint: `${r.photos} com foto` },
    { key: "active-medications", label: "Tratamentos em andamento", value: r.active_meds, format: "number" },
    { key: "doses-24h", label: "Doses previstas (24 h)", value: r.doses_24h, format: "number" },
    { key: "adherence-24h", label: "Doses marcadas como dadas", value: adherence, format: "percent", hint: "últimas 24 h" },
    {
      key: "missed-24h",
      label: "Doses sem \"Já dei\" após 3 h",
      value: r.missed_24h,
      format: "number",
      hint: "últimas 24 h",
    },
    { key: "notifications-24h", label: "Avisos enviados", value: r.notified_24h, format: "number", hint: "últimas 24 h, por dose" },
  ];

  return {
    contract: HUB_CONTRACT_VERSION,
    system: HUB_SYSTEM,
    generatedAt: new Date(now).toISOString(),
    // Conta = família (é ela que tem o código e reúne celulares, crianças e remédios).
    accounts: { total: r.families, active: r.active_families, new30d: r.new_families },
    metrics,
  };
}
