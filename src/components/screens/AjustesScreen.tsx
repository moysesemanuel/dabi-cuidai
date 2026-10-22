"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Art";
import { useReadyApp } from "@/components/AppData";
import { PushSettings } from "@/components/PushSettings";
import { CHILD_COLORS } from "@/lib/types";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function AjustesScreen() {
  const { state, actions } = useReadyApp();
  const kids = state.children;
  const [copied, setCopied] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Ajustes</h1>

      <section aria-labelledby="bebes" className="flex flex-col gap-3">
        <h2 id="bebes" className="text-xl font-bold">Meus bebês</h2>
        {kids.map((k) => (
          <div key={k.id} className="sticker flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <Avatar fill={k.fill} size={40} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor={`nome-${k.id}`} className="text-sm font-bold text-ink-soft">Nome do bebê</label>
                <input
                  id={`nome-${k.id}`}
                  className="field"
                  defaultValue={k.name}
                  placeholder="Ex.: Davi, Bianca"
                  maxLength={30}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== k.name) actions.updateChild(k.id, { name }).catch(() => (e.target.value = k.name));
                    else e.target.value = k.name;
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2" role="group" aria-label={`Cor de ${k.name}`}>
              {CHILD_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => actions.updateChild(k.id, { fill: c.fill })}
                  aria-label={c.label}
                  aria-pressed={k.fill === c.fill}
                  className="size-11 rounded-full border-[3px] border-ink"
                  style={{
                    background: c.fill,
                    boxShadow: k.fill === c.fill ? "0 0 0 3px #fff, 0 0 0 6px #1F2A44" : "none",
                  }}
                />
              ))}
            </div>
            {(kids?.length ?? 0) > 1 && (
              <button
                onClick={() => {
                  if (window.confirm(`Remover ${k.name} e todos os remédios dele(a)?`)) actions.deleteChild(k.id);
                }}
                className="self-start text-sm font-bold text-ink-soft underline"
              >
                Remover {k.name}
              </button>
            )}
          </div>
        ))}
        <button onClick={() => actions.addChild()} className="btn h-12 bg-white px-5 text-base">
          + Adicionar bebê
        </button>
      </section>

      <PushSettings />

      <section aria-labelledby="familia" className="flex flex-col gap-3">
        <h2 id="familia" className="text-xl font-bold">Minha família</h2>
        <div className="sticker flex flex-col gap-3 p-4">
          <p className="text-[15px] leading-snug text-ink-soft">
            Para ver e receber os mesmos remédios em outro celular, abra o app lá e digite este código.
          </p>
          <p className="text-center text-[1.7rem] font-bold tracking-widest tabular-nums" aria-label="Código da família">
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
          <p className="text-sm text-ink-soft">
            {state.deviceCount === 1 ? "1 celular conectado." : `${state.deviceCount} celulares conectados.`} Quem tem o
            código vê os remédios, então compartilhe só com quem cuida dos bebês.
          </p>
          <button
            onClick={() => {
              if (window.confirm("Sair da família neste celular? Os remédios continuam salvos para os outros celulares.")) {
                actions.leaveFamily();
              }
            }}
            className="self-start text-sm font-bold text-ink-soft underline"
          >
            Sair da família neste celular
          </button>
        </div>
      </section>

      <section aria-labelledby="app" className="flex flex-col gap-3">
        <h2 id="app" className="text-xl font-bold">Instalar o app</h2>
        <div className="sticker bg-lilac p-4" style={{ background: "var(--color-lilac)" }}>
          <p className="text-base leading-snug">
            Instale para abrir como app, direto da tela inicial, mesmo sem internet.
          </p>
          {installEvent ? (
            <button onClick={() => installEvent.prompt()} className="btn mt-3 h-12 bg-white px-5 text-base">
              Instalar app
            </button>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              No iPhone: Compartilhar, depois Adicionar à Tela de Início. No Chrome: menu, depois Instalar app.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="aviso" className="flex flex-col gap-2">
        <h2 id="aviso" className="text-xl font-bold">Importante</h2>
        <p className="text-[15px] leading-snug text-ink-soft">
          Este app é só um lembrete de horários. Ele não calcula nem sugere doses: siga sempre a receita e as
          orientações do pediatra. Os remédios ficam guardados na sua família, não só neste aparelho.
        </p>
      </section>
    </div>
  );
}
