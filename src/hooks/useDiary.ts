"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DoseHistoryItem, HealthEntry } from "@/lib/types";

/** Enquanto a tela está aberta, confere de vez em quando se outro celular da família registrou algo. */
const REFRESH_MS = 60_000;

/**
 * Busca com `fetcher` ao abrir, ao voltar para o app e a cada minuto com a tela visível.
 * Respostas que chegam fora de ordem (filtro trocado no meio do caminho) são descartadas.
 */
function usePolled<T>(fetcher: () => Promise<T>, failMessage: string) {
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

  return { data, error };
}

export interface DiaryMonth {
  /** "AAAA-MM" no fuso do aparelho. */
  month: string;
  entries: number;
  doses: number;
}

/** Índice do Diário: quantos registros e doses há em cada mês. */
export function useDiaryMonths(childId: number | null) {
  const fetcher = useCallback(() => {
    const params = new URLSearchParams({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (childId !== null) params.set("childId", String(childId));
    return api<{ months: DiaryMonth[] }>("GET", `/api/diary/months?${params}`).then((r) => r.months);
  }, [childId]);
  return usePolled(fetcher, "Não foi possível carregar o diário.");
}

export interface DiaryData {
  entries: HealthEntry[];
  doses: DoseHistoryItem[];
}

/** Registros e doses de um mês ("AAAA-MM"), no calendário do aparelho. */
export function useDiaryMonth(childId: number | null, month: string) {
  const fetcher = useCallback(async (): Promise<DiaryData> => {
    const [y, m] = month.split("-").map(Number);
    const params = new URLSearchParams({
      from: String(new Date(y, m - 1, 1).getTime()),
      to: String(new Date(y, m, 1).getTime()),
    });
    if (childId !== null) params.set("childId", String(childId));
    const [diary, history] = await Promise.all([
      api<{ entries: HealthEntry[] }>("GET", `/api/diary?${params}`),
      api<{ doses: DoseHistoryItem[] }>("GET", `/api/history/doses?${params}`),
    ]);
    return { entries: diary.entries, doses: history.doses };
  }, [childId, month]);
  return usePolled(fetcher, "Não foi possível carregar este mês.");
}
