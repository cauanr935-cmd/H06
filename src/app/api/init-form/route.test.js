import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { POST } from "./route.js";

const ENV = {
  DOCUSEAL_URL: "https://docuseal.h06.online",
  DOCUSEAL_TOKEN: "tok_secreto",
  DOCUSEAL_TEMPLATE_ID: "7",
  SUBMITTER_ROLE: "Manifestante",
};

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
