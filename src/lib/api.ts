export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Chamada JSON para a API do app. Lança `ApiError` com a mensagem do servidor. */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Sem conexão. Tente de novo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data?.error === "string" ? data.error : "Algo deu errado.");
  return data as T;
}

/** Envia um arquivo (bytes crus) para a API, por exemplo a foto já comprimida de uma criança. */
export async function apiUpload(path: string, file: Blob): Promise<void> {
  let res: Response;
  try {
    res = await fetch(path, { method: "PUT", headers: { "content-type": file.type }, body: file, cache: "no-store" });
  } catch {
    throw new ApiError(0, "Sem conexão. Tente de novo.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, typeof data?.error === "string" ? data.error : "Não foi possível enviar a foto.");
  }
}
