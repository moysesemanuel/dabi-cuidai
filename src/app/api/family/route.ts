import { createFamily } from "@/server/auth";
import { handle, json } from "@/server/http";
import { clientIp, limit } from "@/server/ratelimit";

/** Cria uma família nova e conecta este aparelho. Devolve o código para convidar o outro celular. */
export async function POST(req: Request) {
  return handle(async () => {
    // Várias operadoras compartilham o mesmo IP entre clientes, então o limite é folgado.
    await limit(`create:${clientIp(req)}`, 10, 3_600_000);
    return json({ code: await createFamily(null) }, { status: 201 });
  });
}
