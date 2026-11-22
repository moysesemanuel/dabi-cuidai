"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

/** Enquanto a tela está aberta, confere de vez em quando se outro celular da família registrou algo. */
const REFRESH_MS = 60_000;

/**
 * Busca com `fetcher` ao abrir, ao voltar para o app e a cada minuto com a tela visível.
 * Respostas que chegam fora de ordem (filtro trocado no meio do caminho) são descartadas.
 */
export function usePolled<T>(fetcher: () => Promise<T>, failMessage: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      const value = await fetcher();
      if (id !== seq.current) return;
      setData(value);
      setError(null);
    } catch (err) {
      if (id !== seq.current) return;
      setError(err instanceof ApiError ? err.message : failMessage);
    }
  }, [fetcher, failMessage]);

  useEffect(() => {
    // Fora do corpo do efeito: a primeira busca não dispara render em cascata.
    const first = setTimeout(load, 0);
    const wake = () => document.visibilityState === "visible" && load();
    const tick = setInterval(wake, REFRESH_MS);
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [load]);

  return { data, error, reload: load };
}
