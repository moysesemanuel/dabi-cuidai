import { api } from "./api";

export type PushState =
  | "checking"
  | "unsupported" // navegador sem suporte a avisos
  | "needs-install" // iPhone: só funciona com o app na Tela de Início
  | "denied" // permissão bloqueada pelo usuário
  | "off"
  | "on";

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const hasPushApis = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function readPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "checking";
  if (!hasPushApis()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const sub = await (await registration()).pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** Pede permissão, inscreve este aparelho e avisa o servidor. Precisa ser chamado por um toque do usuário. */
export async function enablePush(): Promise<PushState> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("Avisos não configurados neste servidor.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  await api("POST", "/api/push/subscribe", sub.toJSON());
  return "on";
}

export async function disablePush(): Promise<void> {
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  await api("DELETE", "/api/push/subscribe", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

/** A cada abertura, reenvia a inscrição ao servidor (cobre banco recriado ou inscrição que mudou). */
export async function syncPush(): Promise<void> {
  if (!hasPushApis() || Notification.permission !== "granted") return;
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) await api("POST", "/api/push/subscribe", sub.toJSON());
}

export const sendTestPush = (delayed = false) => api("POST", "/api/push/test", { delayed });
