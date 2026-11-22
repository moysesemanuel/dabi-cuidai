"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { BellIcon, FamilyIcon, HeartIcon, Logo, Mascot, TicketIcon } from "./Art";
import { useApp } from "./AppData";

const FEATURES = [
  { Icon: BellIcon, text: "Lembretes de remédios na hora certa" },
  { Icon: FamilyIcon, text: "Organize os remédios de todas as crianças da família" },
  { Icon: HeartIcon, text: "Acompanhe a rotina de forma simples e segura" },
];

/** Primeira tela: criar a família (primeiro celular) ou entrar com o código (segundo celular). */
export function Welcome() {
  const { actions } = useApp();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "create" | "join", fn: () => Promise<void>) {
    setError(null);
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Algo deu errado. Tente de novo.");
      setBusy(null);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <span className="blob -bottom-24 -left-24 size-44" style={{ background: "var(--c-blob-a)" }} aria-hidden="true" />
      <span className="blob -right-20 -top-20 size-44" style={{ background: "var(--c-blob-b)" }} aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
        <div className="flex flex-col items-center gap-1 text-center">
          <Mascot size={210} />
          <h1 className="mt-1">
            <Logo size={52} />
          </h1>
          <svg width="150" height="10" viewBox="0 0 150 10" aria-hidden="true" className="-mt-0.5">
            <path d="M3 7c40-6 100-6 144-2" stroke="#f6b72f" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </svg>
          <p className="mt-3 text-balance text-[1.4rem] font-extrabold leading-snug">
            Mais tranquilidade na rotina de saúde dos seus filhos
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {FEATURES.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-4">
              <span className="icon-tile">
                <Icon />
              </span>
              <span className="text-[15px] font-semibold leading-snug">{text}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => run("create", actions.createFamily)}
            disabled={busy !== null}
            className="btn btn-primary h-14 text-lg"
          >
            <FamilyIcon /> {busy === "create" ? "Criando..." : "Criar minha família"}
          </button>

          {!joining ? (
            <button onClick={() => setJoining(true)} disabled={busy !== null} className="btn btn-outline h-14 text-lg">
              <TicketIcon /> Entrar com um código
            </button>
          ) : (
            <section className="card flex flex-col gap-3 p-4" aria-labelledby="entrar">
              <h2 id="entrar" className="text-lg font-extrabold">Código da família</h2>
              <p className="text-sm text-ink-soft">
                Abra o app no celular de quem já usa, vá em Perfil e copie o código.
              </p>
              <label htmlFor="codigo" className="sr-only">Código da família</label>
              <input
                id="codigo"
                autoFocus
                className="field uppercase tracking-widest"
                placeholder="XXXX-XXXX-XXXX"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={14}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                onClick={() => run("join", () => actions.joinFamily(code))}
                disabled={busy !== null || code.trim().length < 12}
                className="btn btn-brand h-14 text-lg"
              >
                {busy === "join" ? "Entrando..." : "Entrar"}
              </button>
            </section>
          )}
        </div>

        <p className="text-center text-sm text-ink-soft">
          Os remédios ficam guardados na sua família: quem entrar com o código em outro celular vê os mesmos horários e
          recebe os mesmos avisos.
        </p>

        {error && (
          <p role="alert" className="rounded-2xl border border-line bg-coral p-3 text-base font-bold">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
