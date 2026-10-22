import { describe, expect, it } from "vitest";
import {
  circularDistance,
  clampDays,
  formatClock,
  formatInterval,
  generateDoseTimes,
  isNightMinute,
  parseClock,
  previewDay,
  repeatsDaily,
  toIntervalMinutes,
  totalDoses,
} from "./schedule";

describe("toIntervalMinutes", () => {
  it("soma horas e minutos digitados", () => {
    expect(toIntervalMinutes(8, 0)).toBe(480);
    expect(toIntervalMinutes(7, 30)).toBe(450);
  });
  it("não deixa passar de 15 min para baixo nem de 72 h para cima", () => {
    expect(toIntervalMinutes(0, 0)).toBe(15);
    expect(toIntervalMinutes(0, 5)).toBe(15);
    expect(toIntervalMinutes(200, 0)).toBe(72 * 60);
  });
  it("ignora valores inválidos", () => {
    expect(toIntervalMinutes(NaN, NaN)).toBe(15);
    expect(toIntervalMinutes(-3, 0)).toBe(15);
  });
});

describe("clampDays / totalDoses", () => {
  it("limita de 1 a 60 dias", () => {
    expect(clampDays(0)).toBe(1);
    expect(clampDays(500)).toBe(60);
    expect(clampDays(NaN)).toBe(1);
  });
  it("conta doses do tratamento", () => {
    expect(totalDoses(480, 7)).toBe(21);
    expect(totalDoses(720, 5)).toBe(10);
    expect(totalDoses(450, 3)).toBe(9);
  });
  it("sempre tem ao menos uma dose", () => {
    expect(totalDoses(72 * 60, 1)).toBe(1);
  });
});

describe("generateDoseTimes", () => {
  it("espaça as doses pelo intervalo", () => {
    const start = Date.UTC(2026, 9, 22, 11, 0);
    const times = generateDoseTimes(start, 480, 1);
    expect(times).toEqual([start, start + 8 * 3_600_000, start + 16 * 3_600_000]);
  });
  it("gera o total certo para a duração", () => {
    expect(generateDoseTimes(0, 360, 5)).toHaveLength(20);
  });
});

describe("previewDay", () => {
  it("8 em 8 h a partir das 08:00 termina à meia-noite do dia seguinte", () => {
    const d = previewDay(8 * 60, 480);
    expect(d.map((x) => formatClock(x.minuteOfDay))).toEqual(["08:00", "16:00", "00:00"]);
    expect(d.map((x) => x.dayOffset)).toEqual([0, 0, 1]);
    expect(d.map((x) => x.night)).toEqual([false, false, true]);
  });
  it("aceita intervalos que não dividem 24 h", () => {
    const d = previewDay(8 * 60, 5 * 60);
    expect(d.map((x) => formatClock(x.minuteOfDay))).toEqual([
      "08:00",
      "13:00",
      "18:00",
      "23:00",
      "04:00",
    ]);
    expect(repeatsDaily(300)).toBe(false);
    expect(repeatsDaily(480)).toBe(true);
  });
  it("24 h gera uma dose só", () => {
    expect(previewDay(600, 1440)).toHaveLength(1);
  });
  it("avisa coincidência com outro remédio (±30 min, circular)", () => {
    const others = [{ minuteOfDay: 0, name: "Soro" }];
    const d = previewDay(8 * 60, 480, others);
    expect(d[2].conflictWith).toBe("Soro");
    expect(d[0].conflictWith).toBeUndefined();
    const near = previewDay(23 * 60 + 50, 1440, others);
    expect(near[0].conflictWith).toBe("Soro");
  });
  it("normaliza início negativo ou maior que um dia", () => {
    expect(previewDay(1500, 1440)[0].minuteOfDay).toBe(60);
  });
});

describe("auxiliares", () => {
  it("hora de dormir vai das 20h às 6h", () => {
    expect(isNightMinute(20 * 60)).toBe(true);
    expect(isNightMinute(5 * 60 + 59)).toBe(true);
    expect(isNightMinute(6 * 60)).toBe(false);
    expect(isNightMinute(19 * 60 + 59)).toBe(false);
  });
  it("distância circular", () => {
    expect(circularDistance(10, 1430)).toBe(20);
    expect(circularDistance(600, 630)).toBe(30);
  });
  it("formata e lê horários", () => {
    expect(formatClock(450)).toBe("07:30");
    expect(parseClock("07:30")).toBe(450);
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
  it("formata intervalo", () => {
    expect(formatInterval(480)).toBe("8 h");
    expect(formatInterval(450)).toBe("7 h 30 min");
    expect(formatInterval(45)).toBe("45 min");
  });
});
