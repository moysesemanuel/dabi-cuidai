/**
 * Testes contra um Postgres de verdade: o banco local `cuidai_kids_test` (criado com `createdb cuidai_kids_test`).
 * Sem o .env.local com PGHOST (por exemplo, no CI), o arquivo é pulado.
 */
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
  let fam: Session;
  let other: Session;
  let childA: number;
  let childB: number;

  beforeAll(async () => {
    ({ sql } = await import("./sql"));
    repo = await import("./repo");
    dispatch = await import("./dispatch");
    diary = await import("./diary");
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
    return { familyId: f.id, deviceId: d.id };
  }

  async function newChild(s: Session, name: string): Promise<number> {
    const [c] = await sql<{ id: number }[]>`
      insert into children (family_id, name, fill, created_at) values (${s.familyId}, ${name}, '#FFAFA3', ${Date.now()}) returning id`;
    return c.id;
  }

  beforeEach(async () => {
    await sql`delete from families where code like 'T-%'`;
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
    expect(given).toMatchObject({ medName: "Amoxicilina", doseText: "5 ml", childId: childA, status: "given" });
    expect(given.givenAt).toBeTypeOf("number");

    // A dose de -4 h (depois do começo do dia de quem editou) já foi refeita com os dados novos.
    const recent = history.find((d) => d.scheduledAt === now - 20 * HOUR + 16 * HOUR)!;
    expect(recent).toMatchObject({ medName: "Amoxil", doseText: "7 ml", childId: childB });

    // Doses futuras não entram no histórico.
    expect(history.every((d) => d.scheduledAt <= now)).toBe(true);
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
