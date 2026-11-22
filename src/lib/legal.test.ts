import { describe, expect, it } from "vitest";
import { consentIsCurrent, CURRENT_CONSENT, formatLegalDate, LEGAL_DOCUMENTS } from "./legal";

describe("documentos legais", () => {
  it("cada documento tem versão datada e rota pública", () => {
    for (const doc of Object.values(LEGAL_DOCUMENTS)) {
      expect(doc.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(doc.path.startsWith("/")).toBe(true);
    }
  });

  it("o aceite só vale para as versões atuais dos dois documentos", () => {
    expect(consentIsCurrent(CURRENT_CONSENT)).toBe(true);
    expect(consentIsCurrent({ terms: CURRENT_CONSENT.terms })).toBe(false);
    expect(consentIsCurrent({ ...CURRENT_CONSENT, privacy: "2020-01-01" })).toBe(false);
    expect(consentIsCurrent(null)).toBe(false);
  });

  it("formata a data da versão", () => {
    expect(formatLegalDate("2026-11-21")).toBe("21 de novembro de 2026");
  });
});
