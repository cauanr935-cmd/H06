import { describe, it, expect, vi, beforeEach } from "vitest";

import { getClientIp, checkRateLimit } from "./rate-limit.js";

function reqWithHeader(value) {
  const headers = value === undefined ? {} : { "x-forwarded-for": value };
  return new Request("http://localhost/api/init-form", { headers });
}

describe("getClientIp", () => {
  it("usa o primeiro IP quando há vários", () => {
    expect(getClientIp(reqWithHeader("203.0.113.5, 10.0.0.1, 10.0.0.2"))).toBe("203.0.113.5");
  });

  it("retorna 'unknown' quando o header está ausente, sem lançar", () => {
    expect(() => getClientIp(reqWithHeader(undefined))).not.toThrow();
    expect(getClientIp(reqWithHeader(undefined))).toBe("unknown");
  });

  it("retorna 'unknown' quando o header está vazio", () => {
    expect(getClientIp(reqWithHeader("   "))).toBe("unknown");
  });
});

/**
 * Fake mínimo da REST API do Upstash: mantém contadores e TTL em memória,
 * indexados por chave, e responde no mesmo formato `{ result }`.
 */
function fakeUpstash() {
  const store = new Map(); // key -> { count, expiresAt }

  const fetch = vi.fn(async (url, opts = {}) => {
    const path = url.replace(/^https:\/\/fake-upstash\//, "");
    const [cmd, ...rest] = path.split("/");

    if (cmd === "incr") {
      const key = decodeURIComponent(rest[0]);
      const now = Date.now();
      const entry = store.get(key);
      if (!entry || (entry.expiresAt && entry.expiresAt <= now)) {
        store.set(key, { count: 1, expiresAt: null });
        return { ok: true, json: async () => ({ result: 1 }) };
      }
      entry.count += 1;
      return { ok: true, json: async () => ({ result: entry.count }) };
    }

    if (cmd === "pexpire") {
      const key = decodeURIComponent(rest[0]);
      const ms = Number(rest[1]);
      const entry = store.get(key);
      if (entry) entry.expiresAt = Date.now() + ms;
      return { ok: true, json: async () => ({ result: 1 }) };
    }

    if (cmd === "pttl") {
      const key = decodeURIComponent(rest[0]);
      const entry = store.get(key);
      const ms = entry?.expiresAt ? entry.expiresAt - Date.now() : -1;
      return { ok: true, json: async () => ({ result: ms }) };
    }

    throw new Error(`comando não simulado: ${cmd}`);
  });

  return { fetch, store };
}

const BASE_DEPS = () => {
  const upstash = fakeUpstash();
  return { fetch: upstash.fetch, url: "https://fake-upstash", token: "tok" };
};

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("libera as primeiras 5 requisições e bloqueia a 6ª", async () => {
    const deps = BASE_DEPS();
    for (let i = 0; i < 5; i++) {
      const res = await checkRateLimit(deps, { identifier: "1.1.1.1" });
      expect(res.limited).toBe(false);
    }
    const sixth = await checkRateLimit(deps, { identifier: "1.1.1.1" });
    expect(sixth.limited).toBe(true);
    expect(typeof sixth.retryAfterSeconds).toBe("number");
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("um identifier diferente não é afetado pelo contador do outro", async () => {
    const deps = BASE_DEPS();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(deps, { identifier: "1.1.1.1" });
    }
    const other = await checkRateLimit(deps, { identifier: "2.2.2.2" });
    expect(other.limited).toBe(false);
  });

  it("libera de novo depois que a janela expira", async () => {
    const upstash = fakeUpstash();
    const deps = { fetch: upstash.fetch, url: "https://fake-upstash", token: "tok" };

    for (let i = 0; i < 6; i++) {
      await checkRateLimit(deps, { identifier: "1.1.1.1" });
    }
    const blocked = await checkRateLimit(deps, { identifier: "1.1.1.1" });
    expect(blocked.limited).toBe(true);

    // simula o fim da janela: força o TTL da chave a já ter expirado
    upstash.store.get("ratelimit:init-form:1.1.1.1").expiresAt = Date.now() - 1;

    const afterExpiry = await checkRateLimit(deps, { identifier: "1.1.1.1" });
    expect(afterExpiry.limited).toBe(false);
  });

  it("libera a requisição quando o fetch rejeita (store indisponível), loga o erro", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("network down"));
    const res = await checkRateLimit({ fetch, url: "https://fake-upstash", token: "tok" }, { identifier: "1.1.1.1" });
    expect(res.limited).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("libera a requisição quando o Upstash responde HTTP não-2xx", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const res = await checkRateLimit({ fetch, url: "https://fake-upstash", token: "tok" }, { identifier: "1.1.1.1" });
    expect(res.limited).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});
