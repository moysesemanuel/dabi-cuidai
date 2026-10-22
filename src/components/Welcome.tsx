"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { Mascot } from "./Art";
import { useApp } from "./AppData";

/** Primeira tela: criar a família (primeiro celular) ou entrar com o código (segundo celular). */
export function Welcome() {
  const { actions } = useApp();
  const [code, setCode] = useState("");
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-8">
      <div className="flex items-center gap-3">
        <Mascot size={64} />
        <h1 className="text-3xl font-bold leading-tight">Hora do remedinho</h1>
      </div>
      <p className="text-ink-soft">
        Os remédios ficam guardados na sua família. Assim, quem usar o app em outro celular vê os mesmos horários e
        recebe os mesmos avisos.
      </p>

      <section className="sticker flex flex-col gap-3 p-4" aria-labelledby="criar">
        <h2 id="criar" className="text-xl font-bold">Sou o primeiro a usar</h2>
        <p className="text-[15px] text-ink-soft">Cria a família e gera um código para convidar o outro celular.</p>
        <button
          onClick={() => run("create", actions.createFamily)}
          disabled={busy !== null}
          className="btn h-14 bg-mint text-lg"
        >
          {busy === "create" ? "Criando..." : "Criar minha família"}
        </button>
      </section>

      <section className="sticker flex flex-col gap-3 p-4" aria-labelledby="entrar">
        <h2 id="entrar" className="text-xl font-bold">Já tenho um código</h2>
        <label htmlFor="codigo" className="sr-only">Código da família</label>
        <input
          id="codigo"
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
          className="btn h-14 bg-sun text-lg"
        >
          {busy === "join" ? "Entrando..." : "Entrar"}
        </button>
      </section>

      {error && (
        <p role="alert" className="rounded-2xl border-[2.5px] border-ink bg-blush p-3 text-base font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
