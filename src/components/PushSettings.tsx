"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { disablePush, enablePush, readPushState, sendTestPush, type PushState } from "@/lib/push";
import { useReadyApp } from "./AppData";

/** Liga, testa e desliga os avisos neste celular. */
export function PushSettings() {
  const { state } = useReadyApp();
  const [push, setPush] = useState<PushState>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readPushState().then(setPush).catch(() => setPush("unsupported"));
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage(err instanceof ApiError || err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }
  }

  const others = state.pushDeviceCount;
  return (
    <section aria-labelledby="avisos" className="flex flex-col gap-3">
      <h2 id="avisos" className="text-xl font-bold">Avisos de remédio</h2>
      <div className="sticker flex flex-col gap-3 p-4">
        {push === "checking" && <p className="text-ink-soft">Verificando...</p>}

        {push === "unsupported" && (
          <p className="text-[15px] leading-snug">
            Este navegador não permite avisos. No Android, use o Chrome. No iPhone, instale o app na Tela de Início.
          </p>
        )}

        {push === "needs-install" && (
          <p className="text-[15px] leading-snug">
            No iPhone os avisos só funcionam com o app instalado: toque em <b>Compartilhar</b>, depois em <b>Adicionar à
            Tela de Início</b>, abra o app pelo ícone e volte aqui. (Precisa do iOS 16.4 ou mais novo.)
          </p>
        )}

        {push === "denied" && (
          <p className="text-[15px] leading-snug">
            Os avisos estão <b>bloqueados</b> neste celular. Libere nas configurações do navegador (ou do app instalado)
            para este site e volte aqui.
          </p>
        )}

        {push === "off" && (
          <>
            <p className="text-[15px] leading-snug">
              Receba um aviso no horário de cada dose, mesmo com o app fechado. Se ninguém marcar &quot;Já dei&quot;, o aviso
              se repete a cada 10 minutos.
            </p>
            <button
              disabled={busy}
              onClick={() => run(async () => setPush(await enablePush()))}
              className="btn h-14 bg-mint text-lg"
            >
              {busy ? "Ativando..." : "Ativar avisos neste celular"}
            </button>
          </>
        )}

        {push === "on" && (
          <>
            <p className="text-[15px] font-semibold">Avisos ativos neste celular.</p>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => run(async () => { await sendTestPush(); setMessage("Aviso de teste enviado. Ele deve chegar em instantes."); })}
                className="btn h-12 bg-sun px-4 text-base"
              >
                Enviar aviso de teste
              </button>
              <button
                disabled={busy}
                onClick={() => run(async () => { await disablePush(); setPush("off"); })}
                className="btn h-12 bg-white px-4 text-base"
              >
                Desativar
              </button>
            </div>
          </>
        )}

        {message && <p role="status" className="text-sm font-semibold">{message}</p>}

        <p className="text-sm text-ink-soft">
          {others === 0
            ? "Nenhum celular da família está recebendo avisos ainda."
            : others === 1
              ? "1 celular da família está recebendo avisos."
              : `${others} celulares da família estão recebendo avisos.`}{" "}
          Avisos dependem do celular e da internet: o app é um apoio, siga sempre a receita.
        </p>
      </div>
    </section>
  );
}
