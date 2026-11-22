import { createFamily, parseConsent, requireSession } from "@/server/auth";
import { deleteFamily } from "@/server/family";
import { handle, json, readJson } from "@/server/http";
import { clientIp, limit } from "@/server/ratelimit";

/** Cria uma família nova e conecta este aparelho. Devolve o código para convidar o outro celular. */
export async function POST(req: Request) {
  return handle(async () => {
    // Várias operadoras compartilham o mesmo IP entre clientes, então o limite é folgado.
    await limit(`create:${clientIp(req)}`, 10, 3_600_000);
    const consent = parseConsent((await readJson(req)).consent);
    return json({ code: await createFamily(null, consent) }, { status: 201 });
  });
}

/** Exclui a família inteira e todos os dados dela. Pede `{ confirm: "EXCLUIR" }`. */
export async function DELETE(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    await deleteFamily(session, (await readJson(req)).confirm);
    return json({ ok: true });
  });
}
