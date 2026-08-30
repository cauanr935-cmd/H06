import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { POST } from "./route.js";

const SECRET = "segredo-de-teste-123";

function req(body, headers = {}) {
  return new Request("http://localhost/api/docuseal/webhook", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function authHeaders(secret = SECRET) {
  return { "x-webhook-secret": secret };
}

const FORM_COMPLETED = {
  event_type: "form.completed",
  timestamp: "2026-08-30T12:00:00Z",
  data: {
    id: 42,
    submission_id: 7,
    external_id: "lead-uuid-1",
    application_key: "lead-uuid-1",
    status: "completed",
    email: "joao@ex.com",
    phone: "+5511999998888",
  },
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/docuseal/webhook", () => {
  it("500 server_misconfigured quando falta WEBHOOK_SECRET, sem processar o corpo", async () => {
    const res = await POST(req(FORM_COMPLETED, authHeaders()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_misconfigured" });
    expect(console.log).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("401 quando o header X-Webhook-Secret está ausente", async () => {
    vi.stubEnv("WEBHOOK_SECRET", SECRET);
    const res = await POST(req(FORM_COMPLETED));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("401 quando o header tem valor errado do mesmo tamanho", async () => {
    vi.stubEnv("WEBHOOK_SECRET", SECRET);
    const wrongSameLength = "x".repeat(SECRET.length);
    const res = await POST(req(FORM_COMPLETED, authHeaders(wrongSameLength)));
    expect(res.status).toBe(401);
  });

  it("401 quando o header tem tamanho diferente do esperado, sem lançar exceção", async () => {
    vi.stubEnv("WEBHOOK_SECRET", SECRET);
    await expect(POST(req(FORM_COMPLETED, authHeaders("curto")))).resolves.toBeDefined();
    const res = await POST(req(FORM_COMPLETED, authHeaders("curto")));
    expect(res.status).toBe(401);
  });

  it("200 { ok: true } com header correto e payload válido de form.completed, log mascarado", async () => {
    vi.stubEnv("WEBHOOK_SECRET", SECRET);
    const res = await POST(req(FORM_COMPLETED, authHeaders()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(console.log).toHaveBeenCalledWith(
      "[docuseal-webhook] evento recebido",
      expect.objectContaining({
        event_type: "form.completed",
        submitter_id: 42,
        submission_id: 7,
        lead_id: "lead-uuid-1",
        status: "completed",
      }),
    );
    const [, logged] = console.log.mock.calls[0];
    expect(logged.email).not.toBe("joao@ex.com");
    expect(logged.phone).not.toBe("+5511999998888");
  });

  it("400 invalid_json para corpo malformado", async () => {
    vi.stubEnv("WEBHOOK_SECRET", SECRET);
    const res = await POST(req("{ not json", authHeaders()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  it("400 invalid_payload quando falta event_type/data", async () => {
    vi.stubEnv("WEBHOOK_SECRET", SECRET);
    const res = await POST(req({ foo: "bar" }, authHeaders()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_payload" });
  });

  it("nunca loga o segredo, mesmo se ele aparecer em campos do payload", async () => {
    vi.stubEnv("WEBHOOK_SECRET", SECRET);
    const poisoned = {
      event_type: "form.completed",
      data: { ...FORM_COMPLETED.data, email: SECRET, status: SECRET },
    };

    await POST(req(poisoned, authHeaders()));

    const allLogCalls = [...console.log.mock.calls, ...console.error.mock.calls];
    for (const call of allLogCalls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain(SECRET);
    }
  });

  it("todas as respostas trazem Cache-Control: no-store", async () => {
    vi.stubEnv("WEBHOOK_SECRET", SECRET);
    const res = await POST(req(FORM_COMPLETED, authHeaders()));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
