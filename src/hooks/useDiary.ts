"use client";

import { useCallback } from "react";
import { api } from "@/lib/api";
import { usePolled } from "./usePolled";
import type { DoseHistoryItem, HealthEntry } from "@/lib/types";

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
