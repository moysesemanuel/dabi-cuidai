"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { LEGAL_DOCUMENTS } from "@/lib/legal";
import { Logo, Mascot } from "./Art";
import { useApp } from "./AppData";

/**
 * Caixa de aceite: termos, política e, em destaque, a autorização do responsável para os dados de saúde
 * das crianças (LGPD, art. 14: consentimento específico e em destaque de um dos pais ou responsável).
 */
export function ConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] border-brand/40 bg-brand-soft p-3.5 text-[15px] leading-snug">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--c-brand)]"
      />
      <span>
        Sou mãe, pai ou responsável pelas crianças. Li e aceito os{" "}
        <a href={LEGAL_DOCUMENTS.terms.path} target="_blank" className="font-bold text-brand underline">
          Termos de uso
        </a>{" "}
        e a{" "}
        <a href={LEGAL_DOCUMENTS.privacy.path} target="_blank" className="font-bold text-brand underline">
          Política de privacidade
        </a>
        , e <b>autorizo o registro dos dados de saúde delas</b> no app, para uso da família.
      </span>
    </label>
  );
}

/** Para quem já estava conectado quando os termos (ou uma versão nova deles) passaram a valer. */
export function ConsentGate() {
  const { actions } = useApp();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await actions.acceptConsent();
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente de novo.");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <Mascot size={150} />
        <Logo size={40} />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold">Antes de continuar</h1>
        <p className="text-[15px] leading-snug text-ink-soft">
          O Cuidaí Kids guarda remédios, diário, medições e marcos das crianças. Para seguir usando, confirme que você é
          responsável por elas e que concorda com os termos e com a forma como cuidamos dos dados.
        </p>
      </div>
      <ConsentCheckbox checked={checked} onChange={setChecked} />
      {error && (
        <p role="alert" className="rounded-2xl border border-line bg-coral p-3 font-bold">
          {error}
        </p>
      )}
      <button onClick={accept} disabled={!checked || busy} className="btn btn-primary h-14 text-lg">
        {busy ? "Salvando..." : "Continuar"}
      </button>
      <button
        onClick={() => {
          if (window.confirm("Sair da família neste celular? Os dados continuam salvos para os outros celulares.")) {
            actions.leaveFamily();
          }
        }}
        className="self-center text-sm font-semibold text-ink-soft underline"
      >
        Não aceito: sair da família neste celular
      </button>
    </div>
  );
}
