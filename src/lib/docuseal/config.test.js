import { describe, it, expect } from "vitest";

import { readConfig } from "./config.js";

const FULL = {
  DOCUSEAL_URL: "https://docuseal.h06.online/",
  DOCUSEAL_TOKEN: "tok_abc",
  DOCUSEAL_TEMPLATE_ID: "1",
  SUBMITTER_ROLE: "Manifestante",
};

describe("readConfig", () => {
  it("aceita ambiente completo e remove a barra final da URL", () => {
    const res = readConfig(FULL);
    expect(res.ok).toBe(true);
    expect(res.config).toMatchObject({
      baseUrl: "https://docuseal.h06.online",
      token: "tok_abc",
      templateId: "1",
      role: "Manifestante",
      origem: "lp-carbono",
    });
  });

  it("usa LEAD_ORIGEM quando presente", () => {
    const res = readConfig({ ...FULL, LEAD_ORIGEM: "lp-black-friday" });
    expect(res.ok && res.config.origem).toBe("lp-black-friday");
  });

  it.each(Object.keys(FULL))("falha quando %s está ausente", (key) => {
    const env = { ...FULL };
    delete env[key];
    const res = readConfig(env);
    expect(res.ok).toBe(false);
    expect(res.missing).toContain(key);
  });

  it.each(Object.keys(FULL))("falha quando %s é só espaços", (key) => {
    const res = readConfig({ ...FULL, [key]: "   " });
    expect(res.ok).toBe(false);
  });
});
