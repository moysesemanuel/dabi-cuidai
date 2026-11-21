import { requireSession } from "@/server/auth";
import { handle, HttpError, idParam, json } from "@/server/http";
import { deleteChildPhoto, getChildPhoto, MAX_PHOTO_BYTES, setChildPhoto } from "@/server/repo";

type Ctx = { params: Promise<{ id: string }> };

/** A foto só é entregue a aparelhos da mesma família. O endereço muda a cada troca (?v=), então pode ficar em cache. */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const photo = await getChildPhoto(session, idParam((await params).id));
    if (!photo) throw new HttpError(404, "Sem foto.");
    return new Response(new Uint8Array(photo.bytes), {
      headers: {
        "content-type": photo.type,
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  });
}

/** Recebe a foto já recortada e comprimida no aparelho, como bytes crus (WebP ou JPEG). */
export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_PHOTO_BYTES) throw new HttpError(413, "Foto grande demais.");
    const bytes = new Uint8Array(await req.arrayBuffer());
    await setChildPhoto(session, idParam((await params).id), bytes);
    return json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    await deleteChildPhoto(session, idParam((await params).id));
    return json({ ok: true });
  });
}
