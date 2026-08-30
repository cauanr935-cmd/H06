import { describe, it, expect } from "vitest";

import { maskEmail, maskPhone } from "./mask.js";

describe("maskEmail", () => {
  it("mantém só a primeira letra e o domínio", () => {
    expect(maskEmail("teste@exemplo.com")).toBe("t***@exemplo.com");
  });

  it("não vaza o local-part", () => {
    const masked = maskEmail("joao.silva@fazenda.com.br");
    expect(masked).toBe("j***@fazenda.com.br");
    expect(masked).not.toContain("silva");
  });

  it("não ecoa entrada inválida", () => {
    expect(maskEmail("")).toBe("(vazio)");
    expect(maskEmail(null)).toBe("(vazio)");
    expect(maskEmail("semarroba")).toBe("(invalido)");
  });
});

describe("maskPhone", () => {
  it("mantém só os 4 últimos dígitos", () => {
    const masked = maskPhone("+5511999998888");
    expect(masked).toBe("+55 11 *****-8888");
    expect(masked).not.toContain("99999");
  });

  it("lida com fixo", () => {
    expect(maskPhone("+551133334444")).toBe("+55 11 *****-4444");
  });

  it("não ecoa entrada inválida", () => {
    expect(maskPhone("")).toBe("(vazio)");
    expect(maskPhone(null)).toBe("(vazio)");
    expect(maskPhone("123")).toBe("***");
  });
});
