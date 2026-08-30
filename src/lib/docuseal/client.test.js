import { describe, it, expect, vi } from "vitest";

import { createSubmission, UpstreamError } from "./client.js";

const DEPS = {
  baseUrl: "https://docuseal.h06.online",
  token: "tok_secreto",
  templateId: "7",
  role: "Manifestante",
  origem: "lp-carbono",
};

const INPUT = {
  name: "João da Silva",
  phoneE164: "+5511999998888",
  phoneDisplay: "(11) 99999-8888",
  email: null,
  leadId: "lead-uuid-1",
  extraValues: {},
};

function fakeResponse({ ok = true, status = 200, body = [{ slug: "abc", embed_src: "https://x/s/abc" }] } = {}) {
  return {
    ok,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

function fetchReturning(response) {
  return vi.fn().mockResolvedValue(response);
}

function bodySent(fetchMock) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe("createSubmission", () => {
  it("chama o endpoint com X-Auth-Token e um AbortSignal", async () => {
    const fetchMock = fetchReturning(fakeResponse());
    await createSubmission({ ...DEPS, fetch: fetchMock }, INPUT);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://docuseal.h06.online/api/submissions");
    expect(opts.method).toBe("POST");
    expect(opts.headers["X-Auth-Token"]).toBe("tok_secreto");
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("monta o payload com external_id, metadata e send_email/send_sms falsos", async () => {
    const fetchMock = fetchReturning(fakeResponse());
    await createSubmission({ ...DEPS, fetch: fetchMock }, INPUT);

    const payload = bodySent(fetchMock);
    expect(payload).toMatchObject({
      template_id: 7,
      send_email: false,
      send_sms: false,
    });
    const [submitter] = payload.submitters;
    expect(submitter.external_id).toBe("lead-uuid-1");
    expect(submitter.role).toBe("Manifestante");
    expect(submitter.metadata).toEqual({
      telefone_e164: "+5511999998888",
      email: null,
      origem: "lp-carbono",
    });
  });

  it("envia telefone em formato BR, não E.164", async () => {
    const fetchMock = fetchReturning(fakeResponse());
    await createSubmission({ ...DEPS, fetch: fetchMock }, INPUT);

    const [submitter] = bodySent(fetchMock).submitters;
    expect(submitter.values.nome_completo).toBe("João da Silva");
    expect(submitter.values.telefone).toBe("(11) 99999-8888");
    expect(submitter.values).not.toHaveProperty("email");
  });

  it("inclui values.email e metadata.email só quando o e-mail é informado", async () => {
    const fetchMock = fetchReturning(fakeResponse());
    await createSubmission({ ...DEPS, fetch: fetchMock }, { ...INPUT, email: "j@ex.com" });

    const [submitter] = bodySent(fetchMock).submitters;
    expect(submitter.values.email).toBe("j@ex.com");
    expect(submitter.metadata.email).toBe("j@ex.com");
  });

  it("mescla extraValues da allowlist sem sobrescrever nome_completo/telefone", async () => {
    const fetchMock = fetchReturning(fakeResponse());
    await createSubmission(
      { ...DEPS, fetch: fetchMock },
      { ...INPUT, extraValues: { municipio_uf: "Sorriso/MT", telefone: "(99) 0000-0000", nome_completo: "X" } },
    );

    const [submitter] = bodySent(fetchMock).submitters;
    expect(submitter.values.municipio_uf).toBe("Sorriso/MT");
    expect(submitter.values.telefone).toBe("(11) 99999-8888");
    expect(submitter.values.nome_completo).toBe("João da Silva");
  });

  it("aceita resposta em array", async () => {
    const fetchMock = fetchReturning(fakeResponse({ body: [{ slug: "s1", embed_src: "https://e/s1" }] }));
    const out = await createSubmission({ ...DEPS, fetch: fetchMock }, INPUT);
    expect(out).toEqual({ slug: "s1", embed_src: "https://e/s1" });
  });

  it("aceita resposta em { submitters: [...] }", async () => {
    const fetchMock = fetchReturning(fakeResponse({ body: { submitters: [{ slug: "s2" }] } }));
    const out = await createSubmission({ ...DEPS, fetch: fetchMock }, INPUT);
    expect(out).toEqual({ slug: "s2", embed_src: "https://docuseal.h06.online/s/s2" });
  });

  it("propaga UpstreamError em HTTP 401 sem vazar o corpo do upstream", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = fetchReturning(
      fakeResponse({ ok: false, status: 401, body: "invalid token: super-secret-detail" }),
    );

    await expect(createSubmission({ ...DEPS, fetch: fetchMock }, INPUT)).rejects.toSatisfy(
      (e) => e instanceof UpstreamError && !e.message.includes("super-secret-detail"),
    );
    errSpy.mockRestore();
  });

  it("UpstreamError quando o array vem vazio", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = fetchReturning(fakeResponse({ body: [] }));
    await expect(createSubmission({ ...DEPS, fetch: fetchMock }, INPUT)).rejects.toBeInstanceOf(UpstreamError);
  });

  it("UpstreamError quando o fetch rejeita (timeout/rede), sem exceção não tratada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    await expect(createSubmission({ ...DEPS, fetch: fetchMock }, INPUT)).rejects.toBeInstanceOf(UpstreamError);
  });
});
