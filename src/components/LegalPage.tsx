import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANY, formatLegalDate, LEGAL_DOCUMENTS } from "@/lib/legal";

/** Moldura das páginas legais (públicas, sem login): título, versão, conteúdo e quem responde pelo app. */
export function LegalPage({ doc, children }: { doc: keyof typeof LEGAL_DOCUMENTS; children: ReactNode }) {
  const { title, version } = LEGAL_DOCUMENTS[doc];
  const other = doc === "terms" ? LEGAL_DOCUMENTS.privacy : LEGAL_DOCUMENTS.terms;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 text-[16px] leading-relaxed">
      <Link href="/" className="self-start text-sm font-bold text-brand underline">
        Voltar para o Cuidaí Kids
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="text-sm text-ink-soft">
          Versão de {formatLegalDate(version)}. Quando este documento mudar, publicamos uma nova versão datada e o app
          pede o aceite de novo.
        </p>
      </header>

      {children}

      <footer className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-ink-soft">
        <p>
          <b>{COMPANY.tradeName}</b> · {COMPANY.legalName} · CNPJ {COMPANY.cnpj}
        </p>
        <p>{COMPANY.address}</p>
        <p>
          Contato: <a className="underline" href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a> · Privacidade e
          dados: <a className="underline" href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
        </p>
        <Link href={other.path} className="mt-1 self-start font-semibold underline">
          {other.title}
        </Link>
      </footer>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}
