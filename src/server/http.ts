import { connection, NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

/** Converte erros conhecidos em respostas JSON e esconde detalhes internos. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  // Toda rota da API depende da requisição (cookies, banco): nunca é pré-renderizada no build.
  await connection();
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
    console.error(err);
    return json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // cai no erro abaixo
  }
  throw new HttpError(400, "Corpo da requisição inválido.");
}

export function idParam(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Não encontrado.");
  return id;
}
