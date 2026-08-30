import { describe, it, expect } from "vitest";

import { verifySecret, parseEvent, redactSecret } from "./webhook.js";

describe("verifySecret", () => {
  it("aceita quando os segredos são iguais", () => {
    expect(verifySecret("segredo-123", "segredo-123")).toBe(true);
  });

  it("rejeita valor recebido com tamanho diferente, sem lançar", () => {
    expect(() => verifySecret("segredo-123", "curto")).not.toThrow();
    expect(verifySecret("segredo-123", "curto")).toBe(false);
  });

  it("rejeita valor errado do mesmo tamanho", () => {
    expect(verifySecret("segredo-123", "segredo-456")).toBe(false);
  });

  it("rejeita quando o header está ausente/vazio", () => {
    expect(verifySecret("segredo-123", undefined)).toBe(false);
    expect(verifySecret("segredo-123", null)).toBe(false);
    expect(verifySecret("segredo-123", "")).toBe(false);
  });
});

describe("parseEvent", () => {
  const FORM_COMPLETED = JSON.stringify({
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
  });

  it("extrai os campos de um payload válido de form.completed", () => {
    const res = parseEvent(FORM_COMPLETED);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({
      eventType: "form.completed",
      submitterId: 42,
      submissionId: 7,
      leadId: "lead-uuid-1",
      status: "completed",
      email: "joao@ex.com",
      phone: "+5511999998888",
    });
  });

  it("invalid_json para corpo malformado", () => {
    const res = parseEvent("{ not json");
    expect(res).toEqual({ ok: false, error: "invalid_json" });
  });

  it("invalid_payload quando event_type está ausente", () => {
    const res = parseEvent(JSON.stringify({ data: { id: 1 } }));
    expect(res).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("invalid_payload quando data está ausente", () => {
    const res = parseEvent(JSON.stringify({ event_type: "form.completed" }));
    expect(res).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("payload de submission.* sem external_id no nível raiz: leadId null, sem lançar", () => {
    const res = parseEvent(
      JSON.stringify({
        event_type: "submission.completed",
        data: { id: 7, status: "completed" },
      }),
    );
    expect(res.ok).toBe(true);
    expect(res.data.leadId).toBeNull();
    expect(res.data.submitterId).toBe(7);
  });
});

describe("redactSecret", () => {
  it("substitui campos cujo valor é exatamente o segredo", () => {
    const out = redactSecret({ status: "segredo-123", event_type: "form.completed" }, "segredo-123");
    expect(out.status).toBe("(redigido)");
    expect(out.event_type).toBe("form.completed");
  });

  it("não mexe em campos null/undefined", () => {
    const out = redactSecret({ lead_id: null, status: undefined }, "segredo-123");
    expect(out.lead_id).toBeNull();
    expect(out.status).toBeUndefined();
  });

  it("compara por igualdade de string (número que coincide com o segredo também é redigido)", () => {
    const out = redactSecret({ submission_id: 123 }, "123");
    expect(out.submission_id).toBe("(redigido)");
  });
});
