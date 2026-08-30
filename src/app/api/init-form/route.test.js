import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { POST } from "./route.js";

const ENV = {
  DOCUSEAL_URL: "https://docuseal.h06.online",
  DOCUSEAL_TOKEN: "tok_secreto",
  DOCUSEAL_TEMPLATE_ID: "7",
  SUBMITTER_ROLE: "Manifestante",
  APP_URL: "https://lp.example",
};

const RATE_LIMIT_ENV = {
  UPSTASH_REDIS_REST_URL: "https://fake-upstash",
  UPSTASH_REDIS_REST_TOKEN: "tok_rl",
};

function reqFrom(ip, body = { name: "João", phone: "11999998888" }) {
  return new Request("http://localhost/api/init-form", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

/** Fake mínimo da REST API do Upstash (incr/pexpire/pttl), mesmo formato do rate-limit.test.js. */
function fakeUpstashStore() {
  const store = new Map();
  return {
    handle(url) {
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
        const entry = store.get(key);
        if (entry) entry.expiresAt = Date.now() + Number(rest[1]);
        return { ok: true, json: async () => ({ result: 1 }) };
      }
      if (cmd === "pttl") {
        const key = decodeURIComponent(rest[0]);
        const entry = store.get(key);
        const ms = entry?.expiresAt ? entry.expiresAt - Date.now() : -1;
        return { ok: true, json: async () => ({ result: ms }) };
      }
      throw new Error(`comando não simulado: ${cmd}`);
    },
  };
}

/** fetch que roteia entre o fake do Upstash e uma resposta padrão de sucesso do DocuSeal. */
function multiFetch(upstash) {
  return vi.fn(async (url) => {
    if (url.startsWith("https://fake-upstash")) return upstash.handle(url);
    return { ok: true, status: 200, text: async () => JSON.stringify([{ slug: "abc", embed_src: "https://x/s/abc" }]) };
  });
}

function req(body, { raw = false } = {}) {
  return new Request("http://localhost/api/init-form", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? body : JSON.stringify(body),
  });
}

function okFetch(body = [{ slug: "abc", embed_src: "https://docuseal.h06.online/s/abc" }]) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(body) });
}

function setEnv(env = ENV) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/init-form", () => {
  it("500 server_misconfigured quando falta env, sem chamar o DocuSeal", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    // sem setEnv()

    const res = await POST(req({ name: "X", phone: "(11) 99999-8888" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_misconfigured" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("500 server_misconfigured quando falta APP_URL, sem chamar o DocuSeal", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { APP_URL, ...semAppUrl } = ENV;
    setEnv(semAppUrl);

    const res = await POST(req({ name: "X", phone: "(11) 99999-8888" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_misconfigured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400 invalid_json para corpo malformado", async () => {
    setEnv();
    vi.stubGlobal("fetch", okFetch());
    const res = await POST(req("{ not json", { raw: true }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  it("400 name_required / phone_required", async () => {
    setEnv();
    vi.stubGlobal("fetch", okFetch());

    const r1 = await POST(req({ name: "  ", phone: "(11) 99999-8888" }));
    expect(r1.status).toBe(400);
    expect(await r1.json()).toEqual({ error: "name_required" });

    const r2 = await POST(req({ name: "Fulano" }));
    expect(r2.status).toBe(400);
    expect(await r2.json()).toEqual({ error: "phone_required" });
  });

  it("200 sem e-mail; a chave email não vai no payload enviado", async () => {
    setEnv();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ name: "João", phone: "11999998888" }));
    expect(res.status).toBe(200);

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.submitters[0].values).not.toHaveProperty("email");
    expect(sent.submitters[0].metadata.email).toBeNull();
  });

  it("200 com e-mail vazio; segue sem email em values", async () => {
    setEnv();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ name: "João", phone: "11999998888", email: "   " }));
    expect(res.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.submitters[0].values).not.toHaveProperty("email");
  });

  it("200 com e-mail válido; values.email e metadata.email preenchidos", async () => {
    setEnv();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ name: "João", phone: "11999998888", email: "Joao@Ex.com" }));
    expect(res.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.submitters[0].values.email).toBe("joao@ex.com");
    expect(sent.submitters[0].metadata.email).toBe("joao@ex.com");
  });

  it("ignora telefone vindo do cliente em values, mantém o do servidor", async () => {
    setEnv();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    await POST(
      req({ name: "João", phone: "11999998888", values: { telefone: "(00) 00000-0000", municipio_uf: "Sorriso/MT" } }),
    );
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.submitters[0].values.telefone).toBe("(11) 99999-8888");
    expect(sent.submitters[0].values.municipio_uf).toBe("Sorriso/MT");
  });

  it("payload inclui completed_redirect_url com o lead_id gerado", async () => {
    setEnv();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    await POST(req({ name: "João", phone: "11999998888" }));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.submitters[0].completed_redirect_url).toMatch(
      /^https:\/\/lp\.example\/obrigado\?lead_id=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("502 upstream_error em 401, sem ecoar o corpo do upstream", async () => {
    setEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "secret-upstream-body" }),
    );

    const res = await POST(req({ name: "João", phone: "11999998888" }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json).toEqual({ error: "upstream_error" });
    expect(JSON.stringify(json)).not.toContain("secret-upstream-body");
  });

  it("200 { slug, embed_src, lead_id } com lead_id em formato UUID", async () => {
    setEnv();
    vi.stubGlobal("fetch", okFetch([{ slug: "xyz", embed_src: "https://docuseal.h06.online/s/xyz" }]));

    const res = await POST(req({ name: "João", phone: "11999998888" }));
    const json = await res.json();
    expect(json.slug).toBe("xyz");
    expect(json.embed_src).toBe("https://docuseal.h06.online/s/xyz");
    expect(json.lead_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("aceita resposta { submitters: [...] }", async () => {
    setEnv();
    vi.stubGlobal("fetch", okFetch({ submitters: [{ slug: "sub1" }] }));
    const res = await POST(req({ name: "João", phone: "11999998888" }));
    expect(res.status).toBe(200);
    expect((await res.json()).slug).toBe("sub1");
  });

  it("todas as respostas trazem Cache-Control: no-store", async () => {
    setEnv();
    vi.stubGlobal("fetch", okFetch());
    const res = await POST(req({ name: "João", phone: "11999998888" }));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/init-form — rate limit", () => {
  it("5 requisições da mesma IP passam, a 6ª -> 429 com Retry-After", async () => {
    setEnv({ ...ENV, ...RATE_LIMIT_ENV });
    vi.stubGlobal("fetch", multiFetch(fakeUpstashStore()));

    for (let i = 0; i < 5; i++) {
      const res = await POST(reqFrom("1.1.1.1"));
      expect(res.status).toBe(200);
    }
    const sixth = await POST(reqFrom("1.1.1.1"));
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({ error: "too_many_requests" });
    expect(sixth.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("uma IP diferente não é afetada pelo contador da primeira", async () => {
    setEnv({ ...ENV, ...RATE_LIMIT_ENV });
    vi.stubGlobal("fetch", multiFetch(fakeUpstashStore()));

    for (let i = 0; i < 6; i++) await POST(reqFrom("1.1.1.1"));
    const res = await POST(reqFrom("2.2.2.2"));
    expect(res.status).toBe(200);
  });

  it("x-forwarded-for com múltiplos IPs usa o primeiro", async () => {
    setEnv({ ...ENV, ...RATE_LIMIT_ENV });
    const upstash = fakeUpstashStore();
    vi.stubGlobal("fetch", multiFetch(upstash));

    for (let i = 0; i < 6; i++) {
      await POST(reqFrom("9.9.9.9, 10.0.0.1, 10.0.0.2"));
    }
    const res = await POST(reqFrom("9.9.9.9"));
    expect(res.status).toBe(429);
  });

  it("x-forwarded-for ausente não lança, segue o fluxo normal", async () => {
    setEnv({ ...ENV, ...RATE_LIMIT_ENV });
    vi.stubGlobal("fetch", multiFetch(fakeUpstashStore()));

    const res = await POST(req({ name: "João", phone: "11999998888" }));
    expect(res.status).toBe(200);
  });

  it("Upstash indisponível: requisição passa normalmente (fail-open), erro logado", async () => {
    setEnv({ ...ENV, ...RATE_LIMIT_ENV });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (url.startsWith("https://fake-upstash")) throw new Error("network down");
        return { ok: true, status: 200, text: async () => JSON.stringify([{ slug: "abc", embed_src: "https://x/s/abc" }]) };
      }),
    );

    const res = await POST(reqFrom("1.1.1.1"));
    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalled();
  });

  it("sem UPSTASH_REDIS_REST_URL/TOKEN no ambiente, o endpoint continua funcionando normalmente", async () => {
    setEnv(); // sem RATE_LIMIT_ENV — mesmo comportamento das Fases A/B/C
    vi.stubGlobal("fetch", okFetch());

    const res = await POST(reqFrom("1.1.1.1"));
    expect(res.status).toBe(200);
  });
});
