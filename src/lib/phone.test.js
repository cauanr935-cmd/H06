import { describe, it, expect } from "vitest";

import { toE164BR, toDisplayBR, maskInputBR } from "./phone.js";

describe("toE164BR", () => {
  it.each([
    ["11999998888", "+5511999998888"],
    ["(11) 99999-8888", "+5511999998888"],
    ["+55 11 99999-8888", "+5511999998888"],
    ["5511999998888", "+5511999998888"],
    ["1133334444", "+551133334444"],
    ["551133334444", "+551133334444"],
  ])("normaliza %j -> %j", (input, expected) => {
    expect(toE164BR(input)).toBe(expected);
  });

  it.each([
    ["999998888"], // sem DDD
    [""],
    [null],
    [undefined],
    ["123"],
    ["abc"],
  ])("rejeita %j -> null", (input) => {
    expect(toE164BR(input)).toBeNull();
  });
});

describe("toDisplayBR", () => {
  it("formata celular (11 dígitos)", () => {
    expect(toDisplayBR("11999998888")).toBe("(11) 99999-8888");
  });

  it("formata fixo (10 dígitos)", () => {
    expect(toDisplayBR("1133334444")).toBe("(11) 3333-4444");
  });

  it("aceita entrada já mascarada", () => {
    expect(toDisplayBR("(11) 99999-8888")).toBe("(11) 99999-8888");
  });

  it("descarta o DDI 55 antes de formatar", () => {
    expect(toDisplayBR("+5511999998888")).toBe("(11) 99999-8888");
  });

  it.each([["999998888"], [""], [null]])("retorna null para %j", (input) => {
    expect(toDisplayBR(input)).toBeNull();
  });
});

describe("maskInputBR", () => {
  it.each([
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["1199999", "(11) 9999-9"],
    ["1133334444", "(11) 3333-4444"],
    ["11999998888", "(11) 99999-8888"],
    ["(11) 99999-8888", "(11) 99999-8888"],
    ["119999988889999", "(11) 99999-8888"],
  ])("mascara %j -> %j", (input, expected) => {
    expect(maskInputBR(input)).toBe(expected);
  });
});
