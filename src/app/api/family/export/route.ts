import { requireSession } from "@/server/auth";
import { exportFamily } from "@/server/family";
import { handle } from "@/server/http";

/** Cópia dos dados da família em JSON, como arquivo para baixar. */
export async function GET() {
  return handle(async () => {
    const data = await exportFamily(await requireSession());
    const day = data.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="cuidai-kids-dados-${day}.json"`,
        "cache-control": "no-store",
      },
    });
  });
}
