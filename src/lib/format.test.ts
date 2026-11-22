import { describe, expect, it } from "vitest";
import { fmtDayLabel, fmtTemperature, greeting, parseTemperatureInput } from "./format";

const at = (h: number, m = 0) => new Date(2026, 10, 21, h, m).getTime();

describe("greeting", () => {
  it("muda com a hora do aparelho", () => {
    expect(greeting(at(5))).toBe("Bom dia!");
    expect(greeting(at(11, 59))).toBe("Bom dia!");
    expect(greeting(at(12))).toBe("Boa tarde!");
    expect(greeting(at(18))).toBe("Boa noite!");
    expect(greeting(at(4, 59))).toBe("Boa noite!");
  });

  it("usa só o primeiro nome", () => {
    expect(greeting(at(9), "  Ana Maria Souza ")).toBe("Bom dia, Ana!");
    expect(greeting(at(9), "   ")).toBe("Bom dia!");
  });
});

describe("fmtDayLabel", () => {
  const now = at(10);
  it("diz hoje, ontem ou o dia da semana", () => {
    expect(fmtDayLabel(at(0, 5), now)).toBe("Hoje");
    expect(fmtDayLabel(at(0, 5) - 10 * 60_000, now)).toBe("Ontem");
    expect(fmtDayLabel(new Date(2026, 10, 14, 9).getTime(), now)).toBe("sábado, 14 de novembro");
    expect(fmtDayLabel(new Date(2025, 11, 31, 9).getTime(), now)).toBe("quarta-feira, 31 de dezembro de 2025");
  });
});

describe("temperatura", () => {
  it("formata com vírgula e uma casa", () => {
    expect(fmtTemperature(38)).toBe("38,0 °C");
    expect(fmtTemperature(37.8)).toBe("37,8 °C");
  });

  it("lê vírgula, ponto, inteiro e o sufixo °C", () => {
    expect(parseTemperatureInput("37,8")).toBe(37.8);
    expect(parseTemperatureInput("37.8")).toBe(37.8);
    expect(parseTemperatureInput(" 38 ")).toBe(38);
    expect(parseTemperatureInput("38,5 °C")).toBe(38.5);
    expect(parseTemperatureInput("37,85")).toBe(37.9);
  });

  it("devolve null para vazio ou texto", () => {
    expect(parseTemperatureInput("")).toBeNull();
    expect(parseTemperatureInput("febre")).toBeNull();
    expect(parseTemperatureInput("3")).toBeNull();
    expect(parseTemperatureInput("380")).toBeNull();
  });
});
