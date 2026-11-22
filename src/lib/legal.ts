/**
 * Quem responde pelo Cuidaí Kids e as versões dos documentos legais, num lugar só.
 *
 * A versão é uma data e importa: o que se prova num questionamento é "a pessoa aceitou ESTE texto".
 * Mudou o texto de um documento, suba a versão dele: os celulares passam a pedir o aceite de novo.
 */

export const COMPANY = {
  tradeName: "DaBi Tech",
  legalName: "57.936.721 Moyses Emanuel Costa Silva",
  cnpj: "57.936.721/0001-25",
  address: "Rua Frederico Maurer, Boqueirão, Curitiba/PR, CEP 81670-020",
  /** Encarregado pelo tratamento de dados (LGPD, art. 41) e o canal para pedidos sobre dados. */
  dataProtectionOfficer: "Moyses Emanuel Costa Silva",
  privacyEmail: "moyses.dpo@outlook.com",
  contactEmail: "contato@dabitech.com.br",
  site: "https://www.dabitech.com.br",
} as const;

export const LEGAL_DOCUMENTS = {
  terms: { title: "Termos de uso", path: "/termos", version: "2026-11-21" },
  privacy: { title: "Política de privacidade", path: "/privacidade", version: "2026-11-21" },
} as const;

export interface ConsentVersions {
  terms: string;
  privacy: string;
}

export const CURRENT_CONSENT: ConsentVersions = {
  terms: LEGAL_DOCUMENTS.terms.version,
  privacy: LEGAL_DOCUMENTS.privacy.version,
};

/** O aceite guardado vale para as versões atuais? */
export const consentIsCurrent = (accepted: Partial<ConsentVersions> | null | undefined): boolean =>
  accepted?.terms === CURRENT_CONSENT.terms && accepted?.privacy === CURRENT_CONSENT.privacy;

/** "21 de novembro de 2026". */
export function formatLegalDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}
