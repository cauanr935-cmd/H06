/**
 * Leitura e validação da configuração do DocuSeal a partir do ambiente.
 *
 * Preferimos falhar explícito: se qualquer chave obrigatória faltar, o Route
 * Handler responde 500 `server_misconfigured` sem sequer tentar chamar o DocuSeal.
 * Nenhuma dessas variáveis pode ter prefixo `NEXT_PUBLIC_` (vazaria no bundle).
 */

const REQUIRED = ["DOCUSEAL_URL", "DOCUSEAL_TOKEN", "DOCUSEAL_TEMPLATE_ID", "SUBMITTER_ROLE", "APP_URL"];

const DEFAULT_ORIGEM = "lp-carbono";

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ ok: true, config: { baseUrl: string, token: string, templateId: string, role: string, origem: string, appUrl: string } }
 *           | { ok: false, missing: string[] }}
 */
export function readConfig(env = process.env) {
  const missing = REQUIRED.filter((key) => !String(env[key] ?? "").trim());
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    config: {
      baseUrl: String(env.DOCUSEAL_URL).trim().replace(/\/+$/, ""),
      token: String(env.DOCUSEAL_TOKEN).trim(),
      templateId: String(env.DOCUSEAL_TEMPLATE_ID).trim(),
      role: String(env.SUBMITTER_ROLE).trim(),
      origem: String(env.LEAD_ORIGEM ?? "").trim() || DEFAULT_ORIGEM,
      appUrl: String(env.APP_URL).trim().replace(/\/+$/, ""),
    },
  };
}

/**
 * Leitura independente do segredo do webhook. Separada de `readConfig` de
 * propósito: `/api/docuseal/webhook` não deve ficar acoplado às chaves que
 * `/api/init-form` precisa (e vice-versa) — cada handler falha só pela env
 * que ele de fato usa.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ ok: true, config: { secret: string } } | { ok: false, missing: string[] }}
 */
export function readWebhookConfig(env = process.env) {
  const secret = String(env.WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    return { ok: false, missing: ["WEBHOOK_SECRET"] };
  }
  return { ok: true, config: { secret } };
}
