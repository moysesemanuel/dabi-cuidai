"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { startOfDay } from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import type { AppState, NewMedication } from "@/lib/types";

type Status = "loading" | "signed-out" | "ready" | "unavailable";

interface Actions {
  markGiven(doseId: number): Promise<void>;
  undoGiven(doseId: number): Promise<void>;
  saveMedication(input: NewMedication): Promise<void>;
  updateMedication(id: number, input: NewMedication): Promise<void>;
  deleteMedication(id: number): Promise<void>;
  addChild(): Promise<void>;
  updateChild(id: number, patch: { name?: string; fill?: string }): Promise<void>;
  deleteChild(id: number): Promise<void>;
  createFamily(): Promise<void>;
  joinFamily(code: string): Promise<void>;
  leaveFamily(): Promise<void>;
  importLocal(data: unknown): Promise<void>;
}

interface AppData {
  status: Status;
  state: AppState | undefined;
  /** Hora atual do aparelho (nula até montar, para evitar erro de hidratação). */
  now: number | null;
  /** O último carregamento falhou (sem internet): as telas mostram o que já tinham. */
  offline: boolean;
  actions: Actions;
  /** Tenta carregar de novo depois de uma falha na primeira abertura. */
  retry(): void;
}

const Ctx = createContext<AppData | null>(null);

const REFRESH_MS = 15_000;

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const now = useNow(30_000);
  const dayStart = now === null ? null : startOfDay(now);
  const [status, setStatus] = useState<Status>("loading");
  const [state, setState] = useState<AppState | undefined>();
  const [offline, setOffline] = useState(false);
  const dayStartRef = useRef<number | null>(null);
  dayStartRef.current = dayStart;

  const retry = useCallback(() => setStatus("loading"), []);
  const refresh = useCallback(async () => {
    const ds = dayStartRef.current;
    if (ds === null) return;
    try {
      const next = await api<AppState>("GET", `/api/state?dayStart=${ds}`);
      setState(next);
      setStatus("ready");
      setOffline(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setState(undefined);
        setStatus("signed-out");
      } else {
        setOffline(true);
        // Primeira abertura sem conseguir falar com o servidor: mostra "tentar de novo" em vez de tela vazia.
        setStatus((current) => (current === "loading" ? "unavailable" : current));
      }
    }
  }, []);

  useEffect(() => {
    if (dayStart === null) return;
    refresh();
    const tick = setInterval(() => document.visibilityState === "visible" && refresh(), REFRESH_MS);
    const wake = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [dayStart, refresh]);

  const actions: Actions = useMemo(() => {
    const run = async (fn: () => Promise<unknown>) => {
      await fn();
      await refresh();
    };
    const setDose = (doseId: number, given: boolean) => {
      // Atualiza a tela na hora; o refresh em seguida confirma com o servidor.
      setState((s) =>
        s && {
          ...s,
          doses: s.doses.map((d) =>
            d.id === doseId ? { ...d, status: given ? "given" : "pending", givenAt: given ? Date.now() : undefined } : d,
          ),
        },
      );
      return run(() => api("POST", `/api/doses/${doseId}`, { given })).catch(async (err) => {
        await refresh();
        throw err;
      });
    };
    return {
      markGiven: (id) => setDose(id, true),
      undoGiven: (id) => setDose(id, false),
      saveMedication: (input) => run(() => api("POST", "/api/medications", input)),
      updateMedication: (id, input) =>
        run(() => api("PUT", `/api/medications/${id}`, { ...input, from: startOfDay(Date.now()) })),
      deleteMedication: (id) => run(() => api("DELETE", `/api/medications/${id}`)),
      addChild: () => run(() => api("POST", "/api/children")),
      updateChild: (id, patch) => run(() => api("PATCH", `/api/children/${id}`, patch)),
      deleteChild: (id) => run(() => api("DELETE", `/api/children/${id}`)),
      createFamily: () => run(() => api("POST", "/api/family")),
      joinFamily: (code) => run(() => api("POST", "/api/family/join", { code })),
      leaveFamily: async () => {
        await api("POST", "/api/family/leave");
        setState(undefined);
        setStatus("signed-out");
      },
      importLocal: (data) => run(() => api("POST", "/api/import", data)),
    };
  }, [refresh]);

  // Voltar para "loading" (retry) dispara nova tentativa na próxima rodada de atualização.
  useEffect(() => {
    if (status === "loading" && dayStart !== null) refresh();
  }, [status, dayStart, refresh]);

  const value = useMemo(
    () => ({ status, state, now, offline, actions, retry }),
    [status, state, now, offline, actions, retry],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp precisa estar dentro de <AppDataProvider>.");
  return ctx;
}

/** Para as telas internas: o AppShell só as mostra quando há sessão e dados. */
export function useReadyApp(): { state: AppState; now: number; offline: boolean; actions: Actions } {
  const { state, now, offline, actions } = useApp();
  if (!state || now === null) throw new Error("useReadyApp usado antes de os dados carregarem.");
  return { state, now, offline, actions };
}
