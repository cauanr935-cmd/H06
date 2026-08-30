import { describe, it, expect } from "vitest";

import { parseBody, validate } from "./validate.js";

describe("parseBody", () => {
  it("parseia JSON válido", () => {
    expect(parseBody('{"name":"x"}')).toEqual({ ok: true, value: { name: "x" } });
  });

  it("rejeita JSON malformado", () => {
    expect(parseBody("{name:")).toEqual({ ok: false, error: "invalid_json" });
    expect(parseBody("")).toEqual({ ok: false, error: "invalid_json" });
  });
});

describe("validate", () => {
  const base = { name: "João da Silva", phone: "(11) 99999-8888" };

  it("aceita o payload mínimo (nome + telefone, sem e-mail)", () => {
    const res = validate(base);
    expect(res.ok).toBe(true);
    expect(res.data).toMatchObject({
      name: "João da Silva",
      phoneE164: "+5511999998888",
      phoneDisplay: "(11) 99999-8888",
      email: null,
      extraValues: {},
    });
  });

  it.each([
    [{ ...base, name: "" }, "name_required"],
    [{ ...base, name: "   " }, "name_required"],
    [{ name: "Fulano" }, "phone_required"],
    [{ ...base, phone: "  " }, "phone_required"],
    [{ ...base, phone: "999998888" }, "invalid_phone"],
    [{ ...base, phone: "abc" }, "invalid_phone"],
    [{ ...base, email: "sem-arroba" }, "invalid_email"],
    [{ ...base, email: "sem@tld" }, "invalid_email"],
    [{ ...base, email: "com espaco@exemplo.com" }, "invalid_email"],
  ])("rejeita %o -> %s", (payload, error) => {
    expect(validate(payload)).toEqual({ ok: false, error });
  });

  it("e-mail vazio ou só espaços é válido e não entra em data", () => {
    expect(validate({ ...base, email: "" }).data.email).toBeNull();
    expect(validate({ ...base, email: "   " }).data.email).toBeNull();
  });

  it("normaliza e-mail preenchido (trim + lowercase)", () => {
    const res = validate({ ...base, email: "  Joao@Exemplo.COM  " });
    expect(res.data.email).toBe("joao@exemplo.com");
  });

  it("trunca nome acima de 120 chars sem rejeitar", () => {
    const longo = "A".repeat(200);
    const res = validate({ ...base, name: longo });
    expect(res.ok).toBe(true);
    expect(res.data.name).toHaveLength(120);
  });

  it("mantém apenas chaves da allowlist em values", () => {
    const res = validate({
      ...base,
      values: {
        municipio_uf: "Sorriso/MT",
        qualidade: "Proprietário(a) rural",
        telefone: "(99) 00000-0000",
        nome_completo: "Hacker",
        foo: "bar",
      },
    });
    expect(res.data.extraValues).toEqual({
      municipio_uf: "Sorriso/MT",
      qualidade: "Proprietário(a) rural",
    });
  });

  it("values ausente ou não-objeto vira {}", () => {
    expect(validate(base).data.extraValues).toEqual({});
    expect(validate({ ...base, values: "x" }).data.extraValues).toEqual({});
    expect(validate({ ...base, values: ["a"] }).data.extraValues).toEqual({});
  });
});
