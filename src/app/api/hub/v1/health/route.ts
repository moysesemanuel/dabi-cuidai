import { connection } from "next/server";
import { getHubHealth, hubAuthError, hubJson } from "@/server/hub";

/** Contrato do Dabi Hub (v1): só leitura e só números agregados. Autenticado por DABI_HUB_TOKEN. */
export async function GET(req: Request) {
  await connection();
  const denied = hubAuthError(req);
  if (denied) return denied;
  try {
    return hubJson(await getHubHealth());
  } catch (err) {
    console.error("hub health", err);
    return hubJson({ error: "Erro interno." }, 500);
  }
}
