import { connection } from "next/server";
import { getHubOverview, hubAuthError, hubJson } from "@/server/hub";

/** Contrato do Dabi Hub (v1): só leitura e só números agregados. Autenticado por DABI_HUB_TOKEN. */
export async function GET(req: Request) {
  await connection();
  const denied = hubAuthError(req);
  if (denied) return denied;
  try {
    return hubJson(await getHubOverview());
  } catch (err) {
    console.error("hub overview", err);
    return hubJson({ error: "Erro interno." }, 500);
  }
}
