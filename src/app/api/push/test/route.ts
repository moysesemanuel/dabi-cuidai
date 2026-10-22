import { after } from "next/server";
import { requireSession } from "@/server/auth";
import { handle, HttpError, json } from "@/server/http";
import { sendToDevice } from "@/server/push";

/** Segundos de espera do teste "com o app fechado": dá tempo de fechar o app e bloquear a tela. */
const DELAY_MS = 20_000;

/**
 * Manda um aviso de teste só para este aparelho, para conferir que tudo está ligado.
 * Com `{ delayed: true }` o aviso sai 20 s depois e imita o de uma dose (com o botão "Já dei").
 */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const { delayed } = (await req.json().catch(() => ({}))) as { delayed?: boolean };

    if (delayed) {
      after(async () => {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        const result = await sendToDevice(session.deviceId, {
          title: "Hora do remédio: teste",
          body: "Remédio de teste · 5 ml",
          tag: "teste-dose",
          url: "/",
          doseId: -1,
        });
        console.log("teste atrasado", JSON.stringify(result));
      });
      return json({ ok: true, delayed: true });
    }

    const result = await sendToDevice(session.deviceId, {
      title: "Aviso de teste",
      body: "Está tudo certo: este celular vai receber os lembretes.",
      tag: "teste",
      url: "/ajustes",
    });
    if (result.sent === 0) throw new HttpError(409, "Não consegui enviar. Ative os avisos neste celular primeiro.");
    return json({ ok: true });
  });
}
