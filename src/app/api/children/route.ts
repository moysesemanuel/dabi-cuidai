import { requireSession } from "@/server/auth";
import { handle, json } from "@/server/http";
import { addChild } from "@/server/repo";

export async function POST() {
  return handle(async () => {
    await addChild(await requireSession());
    return json({ ok: true }, { status: 201 });
  });
}
