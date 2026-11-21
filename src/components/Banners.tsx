"use client";

import { useApp } from "./AppData";
import { ImportBanner } from "./ImportBanner";

/** Avisos que valem para o app inteiro: sem conexão e importar dados da versão antiga. */
export function Banners() {
  const { offline } = useApp();
  return (
    <>
      {offline && (
        <p role="status" className="mb-4 rounded-2xl border border-line bg-coral p-2.5 text-sm font-bold">
          Sem conexão: mostrando o que já estava na tela. Os avisos só chegam com internet.
        </p>
      )}
      <ImportBanner />
    </>
  );
}
