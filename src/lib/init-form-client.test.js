import { describe, it, expect, vi } from "vitest";

import { submitLead, mensagemDeErro } from "./init-form-client.js";

function fakeFetch(response) {
  return vi.fn().mockResolvedValue(response);
}

const OK_BODY = { slug: "abc", embed_src: "https://docuseal.h06.online/s/abc", lead_id: "uuid-1" };

describe("submitLead", () => {
  it("envia name e phone, omite email e values vazios", async () => {
    const f = fakeFetch({ ok: true, status: 200, json: async () => OK_BODY });
    const out = await submitLead({ name: "João", phone: "(11) 99999-8888" }, f);

    expect(out).toEqual({ ok: true, data: OK_BODY });
    const sent = JSON.parse(f.mock.calls[0][1].body);
    expect(sent).toEqual({ name: "João", phone: "(11) 99999-8888" });
  });

  it("inclui email e values quando preenchidos, com trim", async () => {
    const f = fakeFetch({ ok: true, status: 200, json: async () => OK_BODY });
    await submitLead(
      { name: "João", phone: "11999998888", email: "j@ex.com", values: { municipio_uf: " Sorriso/MT ", area_hectares: "150", car: "" } },
      f,
    );
    const sent = JSON.parse(f.mock.calls[0][1].body);
    expect(sent.email).toBe("j@ex.com");
    expect(sent.values).toEqual({ municipio_uf: "Sorriso/MT", area_hectares: "150" });
  });

  it("não inclui a chave values se todas vierem vazias", async () => {
    const f = fakeFetch({ ok: true, status: 200, json: async () => OK_BODY });
    await submitLead({ name: "João", phone: "11999998888", values: { municipio_uf: "  " } }, f);
    expect(JSON.parse(f.mock.calls[0][1].body)).not.toHaveProperty("values");
  });

  it("propaga error e status em resposta 400", async () => {
    const f = fakeFetch({ ok: false, status: 400, json: async () => ({ error: "invalid_phone" }) });
    const out = await submitLead({ name: "João", phone: "123" }, f);
    expect(out).toEqual({ ok: false, error: "invalid_phone", status: 400 });
  });

  it("ok:false quando o fetch rejeita (rede)", async () => {
    const f = vi.fn().mockRejectedValue(new Error("network"));
    expect(await submitLead({ name: "João", phone: "11999998888" }, f)).toEqual({ ok: false });
  });

  it("ok:false quando a resposta 200 não tem slug", async () => {
    const f = fakeFetch({ ok: true, status: 200, json: async () => ({}) });
    const out = await submitLead({ name: "João", phone: "11999998888" }, f);
    expect(out.ok).toBe(false);
  });
});

describe("mensagemDeErro", () => {
  it.each([
    ["name_required", undefined, "name"],
    ["phone_required", undefined, "phone"],
    ["invalid_phone", undefined, "phone"],
    ["invalid_email", undefined, "email"],
  ])("mapeia %s para o campo %s", (error, status, campo) => {
    expect(mensagemDeErro(error, status).campo).toBe(campo);
  });

  it("429 tem mensagem de espera e nenhum campo", () => {
    const m = mensagemDeErro(undefined, 429);
    expect(m.campo).toBeNull();
    expect(m.texto).toMatch(/aguarde/i);
  });

  it("erro desconhecido cai na mensagem genérica", () => {
    expect(mensagemDeErro("upstream_error", 502).campo).toBeNull();
    expect(mensagemDeErro(undefined, 500).texto).toMatch(/tente novamente/i);
  });
});
