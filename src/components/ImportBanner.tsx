"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { readLegacyData, type LegacyData } from "@/lib/db";
import { useReadyApp } from "./AppData";

const DISMISSED = "remedinho-import-dismissed";

/** Oferece trazer para a família os remédios que já estavam só neste aparelho (versão antiga). */
export function ImportBanner() {
  const { state, actions } = useReadyApp();
  const [legacy, setLegacy] = useState<LegacyData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {
      // sem localStorage: segue e oferece mesmo assim
    }
    readLegacyData().then(setLegacy).catch(() => {});
  }, []);

  if (!legacy || state.medications.length > 0) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // sem localStorage: o aviso volta na próxima abertura
    }
    setLegacy(null);
  };

  async function onImport() {
    if (!legacy) return;
    setBusy(true);
    setError(null);
    try {
      await actions.importLocal(legacy);
      dismiss();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível importar.");
      setBusy(false);
    }
  }

  const n = legacy.medications.length;
  return (
    <section className="sticker mb-5 flex flex-col gap-2 bg-cream p-4" style={{ background: "var(--color-cream)" }}>
      <h2 className="text-lg font-bold">Trazer os remédios deste celular?</h2>
      <p className="text-[15px] leading-snug">
        Encontrei {n} {n === 1 ? "remédio guardado" : "remédios guardados"} só neste aparelho. Importe para a família
        e os outros celulares passam a ver também.
      </p>
      {error && <p role="alert" className="text-sm font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onImport} disabled={busy} className="btn h-12 flex-1 bg-mint text-base">
          {busy ? "Importando..." : "Importar"}
        </button>
        <button onClick={dismiss} disabled={busy} className="btn h-12 bg-white px-4 text-base">Agora não</button>
      </div>
    </section>
  );
}
