"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, apiUpload } from "@/lib/api";
import { startOfDay } from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import { CURRENT_CONSENT } from "@/lib/legal";
import type { AppState, AsNeededDoseInput, ChildPatch, NewAsNeeded, NewMedication } from "@/lib/types";

type Status = "loading" | "signed-out" | "ready" | "unavailable";

interface Actions {
  markGiven(doseId: number): Promise<void>;
  undoGiven(doseId: number): Promise<void>;
  saveMedication(input: NewMedication): Promise<void>;
  updateMedication(id: number, input: NewMedication): Promise<void>;
  deleteMedication(id: number): Promise<void>;
  saveAsNeeded(input: NewAsNeeded): Promise<void>;
  updateAsNeeded(id: number, input: NewAsNeeded): Promise<void>;
  registerAsNeededDose(medicationId: number, input: AsNeededDoseInput): Promise<void>;
  deleteAsNeededDose(doseId: number): Promise<void>;
  addChild(): Promise<void>;
  updateChild(id: number, patch: ChildPatch): Promise<void>;
  deleteChild(id: number): Promise<void>;
  setDeviceName(name: string): Promise<void>;
  setChildPhoto(id: number, photo: Blob): Promise<void>;
  removeChildPhoto(id: number): Promise<void>;
  createFamily(): Promise<void>;
  joinFamily(code: string): Promise<void>;
  leaveFamily(): Promise<void>;
  /** Troca o código de entrada; os celulares conectados continuam. */
  rotateCode(): Promise<void>;
  /** Exclui a família inteira. `confirm` é a palavra digitada pela pessoa. */
  deleteFamily(confirm: string): Promise<void>;
  /** Aceite dos termos e da política neste aparelho (versões atuais). */
  acceptConsent(): Promise<void>;
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
  /** Busca o estado no servidor. Devolve o estado novo, ou null se não conseguiu falar com o servidor. */
  const refresh = useCallback(async (): Promise<AppState | null> => {
    const ds = dayStartRef.current;
    if (ds === null) return null;
    try {
      const next = await api<AppState>("GET", `/api/state?dayStart=${ds}`);
      setState(next);
      setStatus("ready");
      setOffline(false);
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setState(undefined);
        setStatus("signed-out");
      } else {
        setOffline(true);
        // Primeira abertura sem conseguir falar com o servidor: mostra "tentar de novo" em vez de tela vazia.
        setStatus((current) => (current === "loading" ? "unavailable" : current));
      }
      return null;
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
    /**
     * Medicação: a tela só mostra a dose como dada depois que o servidor confirma. Se a resposta se perder,
     * confere o estado real antes de pedir nova tentativa (o servidor pode ter salvo mesmo assim).
     */
    const setDose = async (doseId: number, given: boolean) => {
      let result: { status: "pending" | "given"; givenAt?: number };
      try {
        result = await api("POST", `/api/doses/${doseId}`, { given });
      } catch (err) {
        const fresh = await refresh();
        const dose = fresh?.doses.find((d) => d.id === doseId);
        if (dose && (dose.status === "given") === given) return;
        throw err;
      }
      // Já confirmado pelo servidor: mostra mesmo que a atualização completa abaixo falhe.
      setState((s) =>
        s && { ...s, doses: s.doses.map((d) => (d.id === doseId ? { ...d, status: result.status, givenAt: result.givenAt } : d)) },
      );
      await refresh();
    };
    return {
      markGiven: (id) => setDose(id, true),
      undoGiven: (id) => setDose(id, false),
      saveMedication: (input) => run(() => api("POST", "/api/medications", input)),
      updateMedication: (id, input) =>
        run(() => api("PUT", `/api/medications/${id}`, { ...input, from: startOfDay(Date.now()) })),
      deleteMedication: (id) => run(() => api("DELETE", `/api/medications/${id}`)),
      saveAsNeeded: (input) => run(() => api("POST", "/api/as-needed", input)),
      updateAsNeeded: (id, input) => run(() => api("PUT", `/api/as-needed/${id}`, input)),
      registerAsNeededDose: (id, input) => run(() => api("POST", `/api/as-needed/${id}/doses`, input)),
      deleteAsNeededDose: (doseId) => run(() => api("DELETE", `/api/as-needed/doses/${doseId}`)),
      addChild: () => run(() => api("POST", "/api/children")),
      updateChild: (id, patch) => run(() => api("PATCH", `/api/children/${id}`, patch)),
      deleteChild: (id) => run(() => api("DELETE", `/api/children/${id}`)),
      setDeviceName: (name) => run(() => api("PATCH", "/api/device", { name })),
      setChildPhoto: (id, photo) => run(() => apiUpload(`/api/children/${id}/photo`, photo)),
      removeChildPhoto: (id) => run(() => api("DELETE", `/api/children/${id}/photo`)),
      // Só chegam aqui depois de a pessoa marcar o aceite na tela de entrada.
      createFamily: () => run(() => api("POST", "/api/family", { consent: CURRENT_CONSENT })),
      joinFamily: (code) => run(() => api("POST", "/api/family/join", { code, consent: CURRENT_CONSENT })),
      acceptConsent: () => run(() => api("POST", "/api/consent", { consent: CURRENT_CONSENT })),
      leaveFamily: async () => {
        await api("POST", "/api/family/leave");
        setState(undefined);
        setStatus("signed-out");
      },
      rotateCode: () => run(() => api("POST", "/api/family/code")),
      deleteFamily: async (confirm) => {
        await api("DELETE", "/api/family", { confirm });
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
