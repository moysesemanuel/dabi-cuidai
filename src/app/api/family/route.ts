import { createFamily } from "@/server/auth";
import { handle, json } from "@/server/http";

/** Cria uma família nova e conecta este aparelho. Devolve o código para convidar o outro celular. */
export async function POST() {
  return handle(async () => json({ code: await createFamily(null) }, { status: 201 }));
}
