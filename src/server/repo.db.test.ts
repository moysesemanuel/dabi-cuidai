/**
 * Testes contra um Postgres de verdade: o banco local `cuidai_kids_test` (criado com `createdb cuidai_kids_test`).
 * Sem o .env.local com PGHOST (por exemplo, no CI), o arquivo é pulado.
 */
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Fora de uma requisição não há cookies nem cabeçalhos: o suficiente para as funções que tiram a sessão.
vi.mock("next/headers", () => ({
  cookies: async () => ({ delete: () => {}, set: () => {}, get: () => undefined }),
  headers: async () => new Headers(),
}));
import type { Session } from "./auth";

const HOUR = 3_600_000;
const hasDb = existsSync(".env.local") && readFileSync(".env.local", "utf8").includes("PGHOST=");
// Antes de qualquer import de ./sql, que abre a conexão com o ambiente do momento: nunca o banco de desenvolvimento.
if (hasDb) {
  process.loadEnvFile(".env.local");
  process.env.PGDATABASE = "cuidai_kids_test";
  delete process.env.DATABASE_URL;
}

describe.skipIf(!hasDb)("repositório (Postgres local)", () => {
  let sql: typeof import("./sql").sql;
  let repo: typeof import("./repo");
  let dispatch: typeof import("./dispatch");
  let diary: typeof import("./diary");
  let growth: typeof import("./growth");
  let milestones: typeof import("./milestones");
  let summary: typeof import("./summary");
  let family: typeof import("./family");
  let asNeeded: typeof import("./asNeeded");
  let fam: Session;
  let other: Session;
  let childA: number;
  let childB: number;
  const created: string[] = [];

  beforeAll(async () => {
    ({ sql } = await import("./sql"));
    repo = await import("./repo");
    dispatch = await import("./dispatch");
    diary = await import("./diary");
    growth = await import("./growth");
    milestones = await import("./milestones");
    summary = await import("./summary");
    family = await import("./family");
    asNeeded = await import("./asNeeded");
    await sql.unsafe(readFileSync("db/schema.sql", "utf8"));
  });

  afterAll(async () => {
    await sql?.end();
  });

  async function newFamily(): Promise<Session> {
    const [f] = await sql<{ id: string }[]>`
      insert into families (code, created_at) values (${`T-${crypto.randomUUID()}`}, ${Date.now()}) returning id`;
    const [d] = await sql<{ id: string }[]>`
      insert into devices (family_id, token_hash, created_at) values (${f.id}, ${crypto.randomUUID()}, ${Date.now()}) returning id`;
    created.push(f.id);
    return { familyId: f.id, deviceId: d.id };
  }

  async function newChild(s: Session, name: string): Promise<number> {
    const [c] = await sql<{ id: number }[]>`
      insert into children (family_id, name, fill, created_at) values (${s.familyId}, ${name}, '#FFAFA3', ${Date.now()}) returning id`;
    return c.id;
  }

  beforeEach(async () => {
    // Pelo id, porque um teste troca o código da família.
    await sql`delete from families where code like 'T-%' or id = any(${created}::uuid[])`;
    created.length = 0;
    fam = await newFamily();
    other = await newFamily();
    childA = await newChild(fam, "Bianca");
    childB = await newChild(fam, "Davi");
  });

  /** Remédio que começou há 20 h, de 8 em 8 h, por 2 dias: doses em -20 h, -12 h, -4 h, +4 h… */
  const startedAgo = (now: number) => ({
    childId: childA,
    name: "Amoxicilina",
    doseText: "5 ml",
    intervalMinutes: 8 * 60,
    firstDoseAt: now - 20 * HOUR,
    days: 2,
  });

  async function giveFirstDose(medId: number) {
    const [first] = await sql<{ id: number }[]>`
      select id from doses where medication_id = ${medId} order by scheduled_at limit 1`;
    await repo.setDoseGiven(fam, first.id, true);
    return first.id;
  }

  it("editar o remédio não muda o nome, a dose nem a criança das doses que já passaram", async () => {
    const now = Date.now();
    const medId = await repo.createMedication(fam, startedAgo(now));
    const givenId = await giveFirstDose(medId);

    const startOfToday = now - 6 * HOUR;
    await repo.updateMedication(fam, medId, { ...startedAgo(now), childId: childB, name: "Amoxil", doseText: "7 ml" }, startOfToday);

    const history = await repo.getDoseHistory(fam, { from: now - 2 * 24 * HOUR, to: now + 24 * HOUR });
    const given = history.find((d) => d.id === givenId)!;
    expect(given).toMatchObject({ medName: "Amoxicilina", doseText: "5 ml", intervalMinutes: 480, childId: childA, status: "given" });
    expect(given.givenAt).toBeTypeOf("number");

    // A dose de -4 h (depois do começo do dia de quem editou) já foi refeita com os dados novos.
    const recent = history.find((d) => d.scheduledAt === now - 20 * HOUR + 16 * HOUR)!;
    expect(recent).toMatchObject({ medName: "Amoxil", doseText: "7 ml", childId: childB });

    // Doses futuras não entram no histórico.
    expect(history.every((d) => d.scheduledAt <= now)).toBe(true);
  });

  it("mudar o intervalo vale só dali em diante: as doses passadas guardam o de quando foram agendadas", async () => {
    const now = Date.now();
    const medId = await repo.createMedication(fam, startedAgo(now));
    await repo.updateMedication(fam, medId, { ...startedAgo(now), intervalMinutes: 6 * 60 }, now - 6 * HOUR);
    const rows = await sql<{ scheduled_at: number; interval_minutes: number }[]>`
      select scheduled_at, interval_minutes from doses where medication_id = ${medId} order by scheduled_at`;
    expect(rows.filter((r) => r.scheduled_at < now - 6 * HOUR).every((r) => r.interval_minutes === 480)).toBe(true);
    expect(rows.filter((r) => r.scheduled_at >= now - 6 * HOUR).every((r) => r.interval_minutes === 360)).toBe(true);
  });

  it("\"Já dei\" repetido não muda o horário da primeira confirmação; desfazer é a correção explícita", async () => {
    const now = Date.now();
    const medId = await repo.createMedication(fam, startedAgo(now));
    const [first] = await sql<{ id: number }[]>`select id from doses where medication_id = ${medId} order by scheduled_at limit 1`;

    const a = await repo.setDoseGiven(fam, first.id, true, now - 60_000);
    expect(a).toEqual({ status: "given", givenAt: now - 60_000, unchanged: false });
    // Outro celular ou um aviso antigo confirma de novo, mais tarde: nada muda.
    const b = await repo.setDoseGiven(fam, first.id, true, now);
    expect(b).toEqual({ status: "given", givenAt: now - 60_000, unchanged: true });

    expect(await repo.setDoseGiven(fam, first.id, false, now)).toMatchObject({ status: "pending", unchanged: false });
    expect(await repo.setDoseGiven(fam, first.id, false, now)).toMatchObject({ status: "pending", unchanged: true });
    expect(await repo.setDoseGiven(fam, first.id, true, now + 1)).toMatchObject({ givenAt: now + 1, unchanged: false });
    await expect(repo.setDoseGiven(other, first.id, true)).rejects.toMatchObject({ status: 404 });
  });

  it("Início: hoje inteiro e as atrasadas sem \"Já dei\" das 24 h anteriores, com criança e remédio da dose", async () => {
    const dayStart = Date.now() - 2 * HOUR;
    const at = (h: number) => dayStart + h * HOUR;
    const medId = await repo.createMedication(fam, { ...startedAgo(Date.now()), firstDoseAt: at(-30), intervalMinutes: 4 * 60, days: 3 });
    const doses = await sql<{ id: number; scheduled_at: number }[]>`select id, scheduled_at from doses where medication_id = ${medId} order by scheduled_at`;
    // Uma dose de ontem já dada some do Início; as pendentes de ontem (até 24 h) ficam.
    const givenYesterday = doses.find((d) => d.scheduled_at === at(-10))!;
    await repo.setDoseGiven(fam, givenYesterday.id, true);
    // O remédio passa para a outra criança só daqui em diante.
    await repo.updateMedication(fam, medId, { ...startedAgo(Date.now()), firstDoseAt: at(-30), intervalMinutes: 4 * 60, days: 3, childId: childB, name: "Novo nome" }, dayStart);

    const state = await repo.getState(fam, dayStart);
    const times = state.doses.map((d) => (d.scheduledAt - dayStart) / HOUR);
    expect(times.filter((h) => h < 0)).toEqual([-22, -18, -14, -6, -2]);
    expect(times).not.toContain(-26);
    expect(times).not.toContain(-10);
    const yesterday = state.doses.find((d) => d.scheduledAt === at(-6))!;
    expect(yesterday).toMatchObject({ childId: childA, medName: "Amoxicilina", doseText: "5 ml" });
    const today = state.doses.find((d) => d.scheduledAt === at(2))!;
    expect(today).toMatchObject({ childId: childB, medName: "Novo nome" });
  });

  it("remover o remédio guarda as doses passadas e apaga só as que ainda viriam", async () => {
    const now = Date.now();
    const medId = await repo.createMedication(fam, startedAgo(now));
    const givenId = await giveFirstDose(medId);
    await repo.deleteMedication(fam, medId, now);

    const history = await repo.getDoseHistory(fam, { childId: childA, from: now - 2 * 24 * HOUR, to: now });
    expect(history.map((d) => d.status)).toEqual(["pending", "pending", "given"]);
    expect(history.every((d) => d.medicationRemoved && d.medName === "Amoxicilina")).toBe(true);
    expect(history.find((d) => d.id === givenId)?.status).toBe("given");

    const [{ future }] = await sql<{ future: number }[]>`
      select count(*)::bigint as future from doses where medication_id = ${medId} and scheduled_at > ${now}`;
    expect(future).toBe(0);

    // Some da lista e da tela de hoje, e não pode mais ser editado nem removido de novo.
    const state = await repo.getState(fam, now - 10 * HOUR);
    expect(state.medications).toEqual([]);
    expect(state.doses).toEqual([]);
    await expect(repo.deleteMedication(fam, medId)).rejects.toMatchObject({ status: 404 });
    await expect(repo.updateMedication(fam, medId, startedAgo(now), now)).rejects.toMatchObject({ status: 404 });
  });

  it("não avisa doses de remédio removido", async () => {
    const now = Date.now();
    // Dose de 30 min atrás, ainda sem aviso: o despacho a pegaria.
    const medId = await repo.createMedication(fam, { ...startedAgo(now), firstDoseAt: now - 30 * 60_000, days: 1 });
    await repo.deleteMedication(fam, medId, now);
    const summary = await dispatch.dispatchDue(now);
    const [dose] = await sql<{ notified_count: number }[]>`select notified_count from doses where medication_id = ${medId}`;
    expect(dose.notified_count).toBe(0);
    expect(summary.due).toBe(0);
  });

  it("remover a criança apaga o histórico dela (é assim que a família exclui dados)", async () => {
    const now = Date.now();
    const medId = await repo.createMedication(fam, startedAgo(now));
    await repo.deleteMedication(fam, medId, now);
    await repo.deleteChild(fam, childA);
    const [{ left }] = await sql<{ left: number }[]>`select count(*)::bigint as left from doses where medication_id = ${medId}`;
    expect(left).toBe(0);
  });

  it("perfil da criança: grava, lê de volta como data civil e não vaza para outra família", async () => {
    await repo.updateChild(fam, childA, { birthDate: "2025-06-01", premature: "yes", gestationalAge: { weeks: 32, days: 4 } });
    const state = await repo.getState(fam, Date.now());
    expect(state.children.find((c) => c.id === childA)).toMatchObject({
      birthDate: "2025-06-01",
      premature: "yes",
      gestationalAge: { weeks: 32, days: 4 },
    });
    // Gêmeo: a outra criança continua sem dados.
    expect(state.children.find((c) => c.id === childB)?.birthDate).toBeUndefined();

    await repo.updateChild(fam, childA, { premature: "no" });
    const after = (await repo.getState(fam, Date.now())).children.find((c) => c.id === childA)!;
    expect(after).toMatchObject({ birthDate: "2025-06-01", premature: "no" });
    expect(after.gestationalAge).toBeUndefined();

    await expect(repo.updateChild(other, childA, { birthDate: "2025-01-01" })).rejects.toMatchObject({ status: 404 });
  });

  it("diário: cria, lista por criança e período, edita e exclui", async () => {
    const now = Date.now();
    const fever = await diary.createHealthEntry(fam, {
      childId: childA,
      occurredAt: now - 2 * HOUR,
      temperature: 38,
      symptoms: [],
      note: "estava mais quietinha",
    });
    await diary.createHealthEntry(fam, { childId: childB, occurredAt: now - 26 * HOUR, temperature: null, symptoms: ["Tosse"], note: "" });
    // Sem sintomas: o array vazio precisa ir e voltar como array.
    const all = await diary.listHealthEntries(fam, { from: now - 2 * 24 * HOUR, to: now + HOUR });
    expect(all.map((e) => e.childId)).toEqual([childA, childB]);
    expect(all[0]).toMatchObject({ temperature: 38, symptoms: [], note: "estava mais quietinha" });
    expect(all[1]).toMatchObject({ symptoms: ["Tosse"] });
    expect(all[1].temperature).toBeUndefined();

    expect(await diary.listHealthEntries(fam, { childId: childB, from: now - 2 * 24 * HOUR, to: now })).toHaveLength(1);
    expect(await diary.listHealthEntries(fam, { from: now - 24 * HOUR, to: now })).toHaveLength(1);

    await diary.updateHealthEntry(fam, fever, {
      childId: childA,
      occurredAt: now - 2 * HOUR,
      temperature: 37.6,
      symptoms: ["Sem apetite"],
      note: "",
    });
    expect(await diary.getHealthEntry(fam, fever)).toMatchObject({ temperature: 37.6, symptoms: ["Sem apetite"], note: "" });

    await diary.deleteHealthEntry(fam, fever);
    await expect(diary.getHealthEntry(fam, fever)).rejects.toMatchObject({ status: 404 });
  });

  it("diário: outra família não lê, não edita, não exclui e não registra para criança alheia", async () => {
    const now = Date.now();
    const id = await diary.createHealthEntry(fam, { childId: childA, occurredAt: now, temperature: 38.2, symptoms: [], note: "" });
    const input = { childId: childA, occurredAt: now, temperature: 36, symptoms: [], note: "" };
    expect(await diary.listHealthEntries(other, { from: now - HOUR, to: now + HOUR })).toEqual([]);
    await expect(diary.listHealthEntries(other, { childId: childA, from: now - HOUR, to: now + HOUR })).rejects.toMatchObject({ status: 404 });
    await expect(diary.getHealthEntry(other, id)).rejects.toMatchObject({ status: 404 });
    await expect(diary.updateHealthEntry(other, id, input)).rejects.toMatchObject({ status: 404 });
    await expect(diary.deleteHealthEntry(other, id)).rejects.toMatchObject({ status: 404 });
    await expect(diary.createHealthEntry(other, input)).rejects.toMatchObject({ status: 404 });
    expect((await diary.getHealthEntry(fam, id)).temperature).toBe(38.2);
  });

  it("diário: remover a criança apaga os registros dela; importar não roda sobre um diário", async () => {
    const now = Date.now();
    await diary.createHealthEntry(fam, { childId: childA, occurredAt: now, temperature: null, symptoms: [], note: "a" });
    await diary.createHealthEntry(fam, { childId: childB, occurredAt: now, temperature: null, symptoms: [], note: "b" });
    await repo.deleteChild(fam, childA);
    const left = await diary.listHealthEntries(fam, { from: now - HOUR, to: now + HOUR });
    expect(left.map((e) => e.note)).toEqual(["b"]);

    const data = { children: [{ id: 1, name: "X", fill: "#FFAFA3" }], medications: [], doses: [] };
    await expect(repo.importLocal(fam, data)).rejects.toMatchObject({ status: 409 });
    expect(await diary.listHealthEntries(fam, { from: now - HOUR, to: now + HOUR })).toHaveLength(1);
  });

  it("índice do diário por mês: conta registros e doses vencidas no fuso do aparelho", async () => {
    const tz = "America/Sao_Paulo";
    // 01/11/2026 às 01:00 em São Paulo (UTC-3) = 04:00 UTC; 31/10 às 23:00 em São Paulo = 01/11 02:00 UTC.
    const nov1 = Date.UTC(2026, 10, 1, 4);
    const oct31Night = Date.UTC(2026, 10, 1, 2);
    const now = Date.UTC(2026, 10, 21, 12);
    const entry = (occurredAt: number, childId = childA) =>
      sql`insert into health_entries (family_id, child_id, occurred_at, note, created_at, updated_at)
          values (${fam.familyId}, ${childId}, ${occurredAt}, 'x', ${now}, ${now})`;
    await entry(nov1);
    await entry(oct31Night);
    await entry(oct31Night, childB);
    const medId = await repo.createMedication(fam, {
      childId: childA, name: "X", doseText: "", intervalMinutes: 12 * 60, firstDoseAt: Date.now() - 30 * HOUR, days: 1,
    });
    expect(medId).toBeGreaterThan(0);

    const months = await diary.diaryMonths(fam, undefined, tz, now);
    expect(months.find((m) => m.month === "2026-10")).toMatchObject({ entries: 2 });
    expect(months.find((m) => m.month === "2026-11")).toMatchObject({ entries: 1 });
    expect((await diary.diaryMonths(fam, childB, tz, now)).find((m) => m.month === "2026-10")).toMatchObject({ entries: 1 });

    // As doses vencidas do remédio aparecem no mês atual (real), e nenhuma dose futura conta.
    const real = await diary.diaryMonths(fam, childA, tz);
    const doses = real.reduce((sum, m) => sum + m.doses, 0);
    const [{ due }] = await sql<{ due: number }[]>`
      select count(*)::bigint as due from doses where medication_id = ${medId} and scheduled_at <= ${Date.now()}`;
    expect(doses).toBe(due);

    await expect(diary.diaryMonths(other, childA, tz)).rejects.toMatchObject({ status: 404 });
    expect(() => diary.parseTimeZone("Marte/Base")).toThrow("Fuso");
    expect(diary.parseTimeZone(tz)).toBe(tz);
  });

  it("crescimento: cria, lista em ordem de data, edita, exclui e protege por família", async () => {
    await repo.updateChild(fam, childA, { birthDate: "2025-06-01" });
    const later = await growth.createGrowth(fam, { childId: childA, measuredOn: "2026-11-10", weightG: 9320, lengthMm: 751, note: "" });
    await growth.createGrowth(fam, { childId: childA, measuredOn: "2025-06-01", weightG: 1860, lengthMm: null, note: "nascimento" });
    await growth.createGrowth(fam, { childId: childB, measuredOn: "2026-11-10", weightG: 9900, lengthMm: null, note: "" });

    const list = await growth.listGrowth(fam, childA);
    expect(list.map((m) => m.measuredOn)).toEqual(["2025-06-01", "2026-11-10"]);
    expect(list[0]).toMatchObject({ weightG: 1860, note: "nascimento" });
    expect(list[0].lengthMm).toBeUndefined();

    await expect(
      growth.createGrowth(fam, { childId: childA, measuredOn: "2025-05-31", weightG: 1800, lengthMm: null, note: "" }),
    ).rejects.toThrow("anterior ao nascimento");

    await growth.updateGrowth(fam, later, { childId: childA, measuredOn: "2026-11-11", weightG: 9350, lengthMm: 752, note: "" });
    expect(await growth.getGrowth(fam, later)).toMatchObject({ measuredOn: "2026-11-11", weightG: 9350, lengthMm: 752 });

    const input = { childId: childA, measuredOn: "2026-11-10", weightG: 1, lengthMm: null, note: "" };
    await expect(growth.listGrowth(other, childA)).rejects.toMatchObject({ status: 404 });
    await expect(growth.getGrowth(other, later)).rejects.toMatchObject({ status: 404 });
    await expect(growth.updateGrowth(other, later, input)).rejects.toMatchObject({ status: 404 });
    await expect(growth.deleteGrowth(other, later)).rejects.toMatchObject({ status: 404 });
    await expect(growth.createGrowth(other, input)).rejects.toMatchObject({ status: 404 });

    await growth.deleteGrowth(fam, later);
    expect(await growth.listGrowth(fam, childA)).toHaveLength(1);
    await repo.deleteChild(fam, childA);
    const [{ left }] = await sql<{ left: number }[]>`
      select count(*)::bigint as left from growth_measurements where family_id = ${fam.familyId}`;
    expect(left).toBe(1);
  });

  it("marcos: cria, lista do mais recente, respeita o nascimento, protege por família e some com a criança", async () => {
    await repo.updateChild(fam, childA, { birthDate: "2025-08-30" });
    const base = { childId: childA, category: null, note: "" } as const;
    const steps = await milestones.createMilestone(fam, { ...base, title: "Primeiros passos", happenedOn: "2026-10-12", precision: "day" });
    await milestones.createMilestone(fam, { ...base, title: "Primeiro sorriso", happenedOn: "2025-10-01", precision: "about" });
    // Mesmo mês do nascimento com precisão de mês: aceito.
    await milestones.createMilestone(fam, { ...base, title: "Mamou bem", happenedOn: "2025-08-01", precision: "month" });
    await expect(
      milestones.createMilestone(fam, { ...base, title: "x", happenedOn: "2025-08-29", precision: "day" }),
    ).rejects.toThrow("anterior ao nascimento");

    const list = await milestones.listMilestones(fam, childA);
    expect(list.map((m) => m.title)).toEqual(["Primeiros passos", "Primeiro sorriso", "Mamou bem"]);
    expect(list[1]).toMatchObject({ precision: "about", happenedOn: "2025-10-01" });
    expect(list[1].category).toBeUndefined();

    await milestones.updateMilestone(fam, steps, { ...base, title: "Primeiros passos sozinha", happenedOn: "2026-10-12", precision: "day", category: "movement" });
    expect(await milestones.getMilestone(fam, steps)).toMatchObject({ title: "Primeiros passos sozinha", category: "movement" });

    const input = { ...base, title: "x", happenedOn: "2026-10-12", precision: "day" } as const;
    await expect(milestones.listMilestones(other, childA)).rejects.toMatchObject({ status: 404 });
    await expect(milestones.getMilestone(other, steps)).rejects.toMatchObject({ status: 404 });
    await expect(milestones.updateMilestone(other, steps, input)).rejects.toMatchObject({ status: 404 });
    await expect(milestones.deleteMilestone(other, steps)).rejects.toMatchObject({ status: 404 });
    await expect(milestones.createMilestone(other, input)).rejects.toMatchObject({ status: 404 });

    await milestones.deleteMilestone(fam, steps);
    expect(await milestones.listMilestones(fam, childA)).toHaveLength(2);

    const data = { children: [{ id: 1, name: "X", fill: "#FFAFA3" }], medications: [], doses: [] };
    await expect(repo.importLocal(fam, data)).rejects.toMatchObject({ status: 409 });

    await repo.deleteChild(fam, childA);
    const [{ left }] = await sql<{ left: number }[]>`select count(*)::bigint as left from milestones where family_id = ${fam.familyId}`;
    expect(left).toBe(0);
  });

  it("resumo: junta o período, com a medição anterior como referência e marcos só do mês", async () => {
    const from = Date.UTC(2026, 9, 21, 3);
    const to = Date.UTC(2026, 10, 22, 3);
    const q = { childId: childA, from, to, fromDate: "2026-10-21", toDate: "2026-11-21" };
    await sql`insert into health_entries (family_id, child_id, occurred_at, temp_tenths, note, created_at, updated_at) values
      (${fam.familyId}, ${childA}, ${from + HOUR}, 384, '', 0, 0),
      (${fam.familyId}, ${childA}, ${from - HOUR}, 390, 'fora do período', 0, 0),
      (${fam.familyId}, ${childB}, ${from + HOUR}, 370, 'outra criança', 0, 0)`;
    const g = (measuredOn: string, weightG: number) => growth.createGrowth(fam, { childId: childA, measuredOn, weightG, lengthMm: null, note: "" });
    await g("2026-09-15", 8600);
    await g("2026-10-01", 8800);
    await g("2026-11-12", 9050);
    const m = (title: string, happenedOn: string, precision: "day" | "month") =>
      milestones.createMilestone(fam, { childId: childA, title, happenedOn, precision, category: null, note: "" });
    await m("Mês do início", "2026-10-01", "month");
    await m("Antes do período", "2026-10-20", "day");
    await m("No período", "2026-11-02", "day");

    const data = await summary.getSummaryData(fam, q);
    expect(data.entries.map((e) => e.temperature)).toEqual([38.4]);
    expect(data.growth.map((x) => x.measuredOn)).toEqual(["2026-10-01", "2026-11-12"]);
    expect(data.milestones.map((x) => x.title).sort()).toEqual(["Mês do início", "No período"]);
    await expect(summary.getSummaryData(other, q)).rejects.toMatchObject({ status: 404 });
  });

  it("aparelhos: lista, marca o atual e desconecta só outro aparelho da mesma família", async () => {
    const [second] = await sql<{ id: string }[]>`
      insert into devices (family_id, token_hash, label, device_info, created_at, last_seen_at)
      values (${fam.familyId}, ${crypto.randomUUID()}, 'Ana', 'iPhone · Safari', 1, ${Date.now()}) returning id`;
    const list = await family.listDevices(fam);
    expect(list).toHaveLength(2);
    expect(list.find((d) => d.current)?.id).toBe(fam.deviceId);
    expect(list.find((d) => d.id === second.id)).toMatchObject({ name: "Ana", kind: "iPhone · Safari", current: false, push: false });

    await expect(family.removeDevice(fam, fam.deviceId)).rejects.toMatchObject({ status: 400 });
    await expect(family.removeDevice(other, second.id)).rejects.toMatchObject({ status: 404 });
    await expect(family.removeDevice(fam, "nao-e-um-uuid")).rejects.toMatchObject({ status: 404 });
    await family.removeDevice(fam, second.id);
    expect(await family.listDevices(fam)).toHaveLength(1);
  });

  it("trocar o código: o antigo para de servir, os aparelhos continuam", async () => {
    const { joinFamily, newCode } = await import("./auth");
    const old = newCode();
    await sql`update families set code = ${old} where id = ${fam.familyId}`;
    const code = await family.rotateFamilyCode(fam);
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(code).not.toBe(old);
    const [row] = await sql<{ code: string; code_changed_at: number }[]>`select code, code_changed_at from families where id = ${fam.familyId}`;
    expect(row.code).toBe(code);
    expect(row.code_changed_at).toBeGreaterThan(0);
    const { CURRENT_CONSENT } = await import("@/lib/legal");
    await expect(joinFamily(old, null, CURRENT_CONSENT)).rejects.toMatchObject({ status: 404 });
    expect(await family.listDevices(fam)).toHaveLength(1);
  });

  it("exportar: traz os dados da família, sem segredos e sem nada de outra família", async () => {
    await repo.updateChild(fam, childA, { birthDate: "2025-08-30", premature: "yes", gestationalAge: { weeks: 35, days: 0 } });
    await repo.setChildPhoto(fam, childA, Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    await diary.createHealthEntry(fam, { childId: childA, occurredAt: Date.now(), temperature: 38.2, symptoms: ["Tosse"], note: "" });
    await diary.createHealthEntry(other, { childId: await newChild(other, "Outra"), occurredAt: Date.now(), temperature: 39, symptoms: [], note: "alheio" });
    const data = await family.exportFamily(fam);
    const text = JSON.stringify(data);
    expect(data.children.find((c) => c.id === childA)).toMatchObject({ birth_date: "2025-08-30", premature: "yes", ga_weeks: 35 });
    expect(data.children.find((c) => c.id === childA)?.photo).toMatch(/^data:image\/jpeg;base64,/);
    expect(data.diary).toEqual([expect.objectContaining({ temperature_c: 38.2, symptoms: ["Tosse"] })]);
    expect(text).not.toContain("alheio");
    expect(text).not.toContain("token_hash");
    const [{ code }] = await sql<{ code: string }[]>`select code from families where id = ${fam.familyId}`;
    expect(text).not.toContain(code);
  });

  it("excluir a família: pede a palavra de confirmação e apaga tudo, sem tocar em outra família", async () => {
    await diary.createHealthEntry(fam, { childId: childA, occurredAt: Date.now(), temperature: null, symptoms: [], note: "x" });
    const otherChild = await newChild(other, "Outra");
    await diary.createHealthEntry(other, { childId: otherChild, occurredAt: Date.now(), temperature: null, symptoms: [], note: "fica" });
    await expect(family.deleteFamily(fam, "excluir tudo")).rejects.toMatchObject({ status: 400 });
    await family.deleteFamily(fam, " excluir ");
    const [{ left }] = await sql<{ left: number }[]>`
      select (select count(*) from families where id = ${fam.familyId})
           + (select count(*) from children where family_id = ${fam.familyId})
           + (select count(*) from devices where family_id = ${fam.familyId})
           + (select count(*) from health_entries where family_id = ${fam.familyId}) as left`;
    expect(Number(left)).toBe(0);
    expect(await diary.listHealthEntries(other, { from: 0, to: Date.now() + HOUR })).toHaveLength(1);
  });

  it("aceite: aparelho sem aceite precisa aceitar; aceite de versão antiga não vale; criar família já grava o aceite", async () => {
    const { acceptConsent, createFamily, parseConsent } = await import("./auth");
    const { CURRENT_CONSENT } = await import("@/lib/legal");
    expect((await repo.getState(fam, Date.now())).consentRequired).toBe(true);
    await expect(acceptConsent(fam, { terms: "2020-01-01", privacy: CURRENT_CONSENT.privacy })).rejects.toMatchObject({ status: 400 });
    await acceptConsent(fam, CURRENT_CONSENT);
    expect((await repo.getState(fam, Date.now())).consentRequired).toBe(false);
    const [row] = await sql<{ consent_at: number }[]>`select consent_at from devices where id = ${fam.deviceId}`;
    expect(row.consent_at).toBeGreaterThan(0);

    expect(() => parseConsent(undefined)).toThrow("aceite");
    const code = await createFamily(null, parseConsent(CURRENT_CONSENT));
    const [created] = await sql<{ id: string; terms_version: string; privacy_version: string }[]>`
      select f.id, d.terms_version, d.privacy_version from families f join devices d on d.family_id = f.id where f.code = ${code}`;
    if (created) await sql`update families set code = ${`T-${crypto.randomUUID()}`} where id = ${created.id}`;
    expect(created).toMatchObject({ terms_version: CURRENT_CONSENT.terms, privacy_version: CURRENT_CONSENT.privacy });
  });

  it("se necessário: sem horários nem avisos; cada dose registrada com motivo e temperatura vai para o histórico", async () => {
    const now = Date.now();
    const medId = await asNeeded.createAsNeeded(fam, { childId: childA, name: "Paracetamol", doseText: "10 gotas", instructions: "se febre" });
    // Não gera doses e não aparece na lista de horários.
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::bigint as n from doses where medication_id = ${medId}`;
    expect(n).toBe(0);
    let state = await repo.getState(fam, now - 2 * HOUR);
    expect(state.medications).toEqual([]);
    expect(state.asNeeded).toEqual([expect.objectContaining({ id: medId, name: "Paracetamol", instructions: "se febre" })]);
    expect(state.asNeeded[0].lastGivenAt).toBeUndefined();

    const doseId = await asNeeded.registerAsNeededDose(fam, medId, { givenAt: now - HOUR, reason: "Febre", temperature: 38.4 });
    state = await repo.getState(fam, now - 2 * HOUR);
    expect(state.asNeeded[0].lastGivenAt).toBe(now - HOUR);
    // Fica fora da lista de doses do dia (não tem "Já dei" nem "Desfazer").
    expect(state.doses).toEqual([]);
    // Não entra na fila de avisos.
    expect((await dispatch.dispatchDue(now)).due).toBe(0);

    const history = await repo.getDoseHistory(fam, { childId: childA, from: now - 2 * HOUR, to: now });
    expect(history).toEqual([
      expect.objectContaining({ id: doseId, asNeeded: true, status: "given", givenAt: now - HOUR, reason: "Febre", temperature: 38.4 }),
    ]);
    expect(history[0].intervalMinutes).toBeUndefined();

    // Editar o remédio não reescreve a dose já registrada; e a rota de horário fixo não edita um "se necessário".
    await asNeeded.updateAsNeeded(fam, medId, { childId: childB, name: "Paracetamol 200", doseText: "12 gotas", instructions: "" });
    expect((await asNeeded.listAsNeededDoses(fam, medId))[0]).toMatchObject({ id: doseId, reason: "Febre", temperature: 38.4 });
    expect((await repo.getDoseHistory(fam, { childId: childA, from: now - 2 * HOUR, to: now }))[0].medName).toBe("Paracetamol");
    await expect(repo.updateMedication(fam, medId, startedAgo(now), now)).rejects.toMatchObject({ status: 404 });

    // Outra família não registra, não lê e não apaga; apagar só vale para dose de "se necessário".
    await expect(asNeeded.registerAsNeededDose(other, medId, { givenAt: now, reason: "", temperature: null })).rejects.toMatchObject({ status: 404 });
    await expect(asNeeded.listAsNeededDoses(other, medId)).rejects.toMatchObject({ status: 404 });
    await expect(asNeeded.deleteAsNeededDose(other, doseId)).rejects.toMatchObject({ status: 404 });
    const fixed = await repo.createMedication(fam, startedAgo(now));
    const [fixedDose] = await sql<{ id: number }[]>`select id from doses where medication_id = ${fixed} limit 1`;
    await expect(asNeeded.deleteAsNeededDose(fam, fixedDose.id)).rejects.toMatchObject({ status: 404 });
    await asNeeded.deleteAsNeededDose(fam, doseId);
    expect(await asNeeded.listAsNeededDoses(fam, medId)).toEqual([]);

    // Remover o remédio usa a mesma rota dos outros e o tira da lista.
    await repo.deleteMedication(fam, medId);
    expect((await repo.getState(fam, now)).asNeeded).toEqual([]);
  });

  it("se necessário: validação da dose registrada", () => {
    const now = 1_800_000_000_000;
    expect(asNeeded.parseAsNeededDose({ givenAt: now - 60_000, reason: " Dor ", temperature: 37.84 }, now)).toEqual({
      givenAt: now - 60_000,
      reason: "Dor",
      temperature: 37.8,
    });
    expect(() => asNeeded.parseAsNeededDose({ givenAt: now + 2 * HOUR }, now)).toThrow("futuro");
    expect(() => asNeeded.parseAsNeededDose({ givenAt: now - 8 * 24 * HOUR }, now)).toThrow("7 dias");
    expect(() => asNeeded.parseAsNeededDose({ givenAt: now, temperature: 45 }, now)).toThrow("entre 34 e 43");
    expect(() => asNeeded.parseAsNeeded({ childId: 1, name: "X", doseText: " " })).toThrow("Dose");
  });

  it("uma família não vê o histórico da outra", async () => {
    const now = Date.now();
    await repo.createMedication(fam, startedAgo(now));
    expect(await repo.getDoseHistory(other, { from: now - 2 * 24 * HOUR, to: now })).toEqual([]);
    await expect(repo.getDoseHistory(other, { childId: childA, from: now - 2 * 24 * HOUR, to: now })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("parseHistoryQuery", async () => {
  const { parseHistoryQuery } = await import("./repo");
  const now = 1_800_000_000_000;
  const q = (s: string) => parseHistoryQuery(new URLSearchParams(s), now);

  it("usa os últimos 30 dias quando não há período", () => {
    expect(q("")).toEqual({ childId: undefined, from: now - 30 * 24 * HOUR, to: now });
  });

  it("recusa período invertido, longo demais ou criança inválida", () => {
    expect(() => q(`from=${now}&to=${now - 1}`)).toThrow("Período inválido");
    expect(() => q(`from=${now - 401 * 24 * HOUR}&to=${now}`)).toThrow("longo demais");
    expect(() => q("childId=abc")).toThrow("Criança inválida");
    expect(() => q("from=xyz")).toThrow("Período inválido");
  });
});
