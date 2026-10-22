import { requireSession } from "@/server/auth";
import { handle, HttpError, json } from "@/server/http";
import { sendToDevice } from "@/server/push";

/** Manda um aviso de teste só para este aparelho, para conferir que tudo está ligado. */
export async function POST() {
  return handle(async () => {
    const session = await requireSession();
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
