"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellIcon, ChevronIcon } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { api, ApiError } from "@/lib/api";

interface DeviceInfo {
  id: string;
  name?: string;
  kind?: string;
  connectedAt: number;
  lastSeenAt?: number;
  current: boolean;
  push: boolean;
}

const DAY = 86_400_000;

/** "hoje", "ontem", "há 5 dias", "em 12/03/2026". */
function seen(ms: number | undefined, now: number): string {
  if (!ms) return "sem uso registrado";
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / DAY);
  if (days <= 0) return "usado hoje";
  if (days === 1) return "usado ontem";
  if (days < 30) return `usado há ${days} dias`;
  return `usado em ${new Date(ms).toLocaleDateString("pt-BR")}`;
}

/** Código da família, celulares conectados e sair: quem tem acesso aos dados. */
export function FamilyAccess() {
  const { state, now, actions } = useReadyApp();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setDevices((await api<{ devices: DeviceInfo[] }>("GET", "/api/family/devices")).devices);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os celulares.");
    }
  }, []);

  // Busca a lista só quando a pessoa abre a seção (e de novo se o número de celulares mudar).
  useEffect(() => {
    if (!showDevices) return;
    const t = setTimeout(loadDevices, 0);
    return () => clearTimeout(t);
  }, [showDevices, state.deviceCount, loadDevices]);

  async function rotate() {
    setBusy(true);
    setError(null);
    try {
      await actions.rotateCode();
      setConfirmRotate(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível trocar o código.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(d: DeviceInfo) {
    const who = d.name ? `o celular de ${d.name}` : `este aparelho (${d.kind ?? "sem identificação"})`;
    if (!window.confirm(`Desconectar ${who}? Ele perde o acesso na hora e para de receber os avisos.`)) return;
    setError(null);
    try {
      await api("DELETE", `/api/family/devices/${d.id}`);
      await loadDevices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível desconectar.");
    }
  }

  return (
    <section aria-labelledby="familia" className="flex flex-col gap-2">
      <h2 id="familia" className="group-label">Minha família</h2>
      <div className="card flex flex-col gap-3 p-4">
        <p className="text-[15px] leading-snug text-ink-soft">
          Para usar o app em outro celular, abra o Cuidaí Kids lá e digite este código.
        </p>
        <p className="text-center text-[1.7rem] font-semibold tracking-widest tabular-nums" aria-label="Código da família">
          {state.familyCode}
        </p>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(state.familyCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // sem permissão de área de transferência: o código está visível na tela
            }
          }}
          className="btn h-12 bg-white px-5 text-base"
        >
          {copied ? "Copiado!" : "Copiar código"}
        </button>

        <p className="rounded-2xl bg-sun/30 p-3 text-sm leading-snug">
          <b>Quem tem o código vê e altera tudo da família:</b> remédios, diário, medições, marcos e fotos. Compartilhe só
          com quem cuida das crianças. Se o código foi parar com outra pessoa, troque o código e desconecte os celulares
          que você não reconhece.
        </p>

        {confirmRotate ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-line p-3">
            <p className="text-sm leading-snug">
              Trocar o código? Os celulares já conectados continuam funcionando. Quem ainda não entrou vai precisar do
              código novo, e o antigo para de funcionar.
            </p>
            <div className="flex gap-2">
              <button onClick={rotate} disabled={busy} className="btn btn-brand h-11 flex-1 text-base">
                Trocar código
              </button>
              <button onClick={() => setConfirmRotate(false)} disabled={busy} className="btn btn-outline h-11 flex-1 text-base">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmRotate(true)} className="self-start text-sm font-bold text-brand underline">
            Trocar o código da família
          </button>
        )}

        <div className="rounded-2xl border border-line">
          <button
            type="button"
            onClick={() => setShowDevices((v) => !v)}
            aria-expanded={showDevices}
            aria-controls="celulares"
            className="flex w-full items-center gap-3 p-3 text-left"
          >
            <span className="flex-1 text-[15px] font-extrabold">
              {state.deviceCount === 1 ? "1 celular conectado" : `${state.deviceCount} celulares conectados`}
            </span>
            <span className={"text-ink-soft transition-transform " + (showDevices ? "rotate-90" : "")}>
              <ChevronIcon />
            </span>
          </button>
          {showDevices && (
            <ul id="celulares" className="flex flex-col border-t border-line">
              {!devices && <li className="p-3 text-sm text-ink-soft">Carregando…</li>}
              {devices?.map((d) => (
                <li key={d.id} className="flex items-center gap-3 border-b border-line p-3 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold">
                      {d.name ?? "Sem nome"}
                      {d.current && (
                        <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-extrabold text-brand">
                          este celular
                        </span>
                      )}
                    </span>
                    <span className="block text-sm text-ink-soft">
                      {d.kind ?? "Aparelho"} · {seen(d.lastSeenAt ?? d.connectedAt, now)}
                    </span>
                    {d.push && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-ink-soft">
                        <BellIcon size={14} /> recebe os avisos
                      </span>
                    )}
                  </span>
                  {!d.current && (
                    <button onClick={() => disconnect(d)} className="btn btn-outline h-9 shrink-0 px-3 text-sm text-danger">
                      Desconectar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        )}

        <button
          onClick={() => {
            if (window.confirm("Sair da família neste celular? Os dados continuam salvos para os outros celulares.")) {
              actions.leaveFamily();
            }
          }}
          className="self-start text-sm font-semibold text-ink-soft underline"
        >
          Sair da família neste celular
        </button>
      </div>
    </section>
  );
}

/** Baixar uma cópia, excluir tudo e a política de privacidade. */
export function FamilyData() {
  const { actions } = useReadyApp();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = word.trim().toUpperCase() === "EXCLUIR";

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await actions.deleteFamily(word);
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir. Tente de novo.");
    }
  }

  return (
    <section aria-labelledby="dados" className="flex flex-col gap-2">
      <h2 id="dados" className="group-label">Seus dados</h2>
      <div className="card flex flex-col gap-3 p-4">
        <p className="text-[15px] leading-snug text-ink-soft">
          Os dados ficam guardados para a família toda, não só neste celular. Você pode baixar uma cópia ou excluir tudo
          quando quiser.
        </p>
        {/* Link comum: o próprio servidor manda o arquivo como download. */}
        <a href="/api/family/export" className="btn btn-outline h-12 text-base">
          Baixar uma cópia dos dados
        </a>

        {!open ? (
          <button onClick={() => setOpen(true)} className="self-start text-sm font-bold text-danger underline">
            Excluir todos os dados da família
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-danger/40 p-3">
            <p className="text-sm leading-snug">
              <b>Isso apaga de vez</b> as crianças, as fotos, os remédios, o histórico de doses, o diário, as medições e os
              marcos, e desconecta todos os celulares da família. Não dá para desfazer. Se quiser guardar, baixe uma
              cópia antes.
            </p>
            <label htmlFor="confirmar-exclusao" className="text-sm font-semibold">
              Digite EXCLUIR para confirmar
            </label>
            <input
              id="confirmar-exclusao"
              className="field"
              autoComplete="off"
              autoCapitalize="characters"
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm font-bold text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={remove} disabled={!ready || busy} className="btn btn-danger h-11 flex-1 text-base">
                Excluir tudo
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setWord("");
                  setError(null);
                }}
                disabled={busy}
                className="btn btn-outline h-11 flex-1 text-base"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <Link href="/privacidade" className="self-start text-sm font-semibold text-ink-soft underline">
          Política de privacidade
        </Link>
      </div>
    </section>
  );
}
