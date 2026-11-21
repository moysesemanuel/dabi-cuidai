import { afterEach, describe, expect, it } from "vitest";
import { hubAuthError } from "./hub";

const TOKEN = "t".repeat(40);
const req = (auth?: string) => new Request("http://x/api/hub/v1/health", { headers: auth ? { authorization: auth } : {} });

describe("hubAuthError", () => {
  afterEach(() => {
    delete process.env.DABI_HUB_TOKEN;
  });

  it("responde 503 sem segredo ou com segredo curto", () => {
    expect(hubAuthError(req(`Bearer ${TOKEN}`))?.status).toBe(503);
    process.env.DABI_HUB_TOKEN = "curto";
    expect(hubAuthError(req("Bearer curto"))?.status).toBe(503);
  });

  it("responde 401 com token errado, ausente ou fora do formato Bearer", () => {
    process.env.DABI_HUB_TOKEN = TOKEN;
    expect(hubAuthError(req())?.status).toBe(401);
    expect(hubAuthError(req(`Bearer ${"x".repeat(40)}`))?.status).toBe(401);
    expect(hubAuthError(req(TOKEN))?.status).toBe(401);
  });

  it("libera com o token certo", () => {
    process.env.DABI_HUB_TOKEN = TOKEN;
    expect(hubAuthError(req(`Bearer ${TOKEN}`))).toBeNull();
  });
});
