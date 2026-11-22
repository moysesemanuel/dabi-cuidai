import { requireSession } from "@/server/auth";
import { listDevices } from "@/server/family";
import { handle, json } from "@/server/http";

/** Aparelhos conectados à família. */
export async function GET() {
  return handle(async () => json({ devices: await listDevices(await requireSession()) }));
}
