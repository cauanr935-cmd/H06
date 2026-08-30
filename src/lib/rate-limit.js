/**
 * Rate limit de janela fixa contra a REST API do Upstash Redis (INCR/PEXPIRE/
 * PTTL via `fetch` cru, sem SDK — mesmo padrão de `docuseal/client.js`).
 *
 * Camada defensiva, não essencial: falha de config ou de runtime nunca
 * derruba o endpoint que ela protege (fail-open). Nunca logar o token.
 */

const REQUIRED = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ ok: true, config: { url: string, token: string } } | { ok: false, missing: string[] }}
 */
export function readRateLimitConfig(env = process.env) {
  const missing = REQUIRED.filter((key) => !String(env[key] ?? "").trim());
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return {
    ok: true,
    config: {
      url: String(env.UPSTASH_REDIS_REST_URL).trim().replace(/\/+$/, ""),
      token: String(env.UPSTASH_REDIS_REST_TOKEN).trim(),
    },
  };
}

/**
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  const header = request.headers.get("x-forwarded-for");
  const first = header?.split(",")[0]?.trim();
  return first || "unknown";
}

/**
 * @param {{ fetch: typeof fetch, url: string, token: string }} deps
 * @param {{ identifier: string, limit?: number, windowMs?: number }} input
 * @returns {Promise<{ limited: boolean, retryAfterSeconds?: number }>}
 */
export async function checkRateLimit(deps, { identifier, limit = 5, windowMs = 10 * 60 * 1000 }) {
  const { fetch: fetchImpl, url, token } = deps;
  const key = `ratelimit:init-form:${identifier}`;
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const incrRes = await fetchImpl(`${url}/incr/${encodeURIComponent(key)}`, { method: "POST", headers });
    if (!incrRes.ok) throw new Error(`incr http ${incrRes.status}`);
    const { result: count } = await incrRes.json();

    if (count === 1) {
      const expireRes = await fetchImpl(`${url}/pexpire/${encodeURIComponent(key)}/${windowMs}`, {
        method: "POST",
        headers,
      });
      if (!expireRes.ok) throw new Error(`pexpire http ${expireRes.status}`);
    }

    if (count > limit) {
      const pttlRes = await fetchImpl(`${url}/pttl/${encodeURIComponent(key)}`, { method: "GET", headers });
      if (!pttlRes.ok) throw new Error(`pttl http ${pttlRes.status}`);
      const { result: pttlMs } = await pttlRes.json();
      const retryAfterSeconds = Math.max(1, Math.ceil((pttlMs > 0 ? pttlMs : windowMs) / 1000));
      return { limited: true, retryAfterSeconds };
    }

    return { limited: false };
  } catch (err) {
    console.error("[rate-limit] falha ao consultar o store, liberando a requisição:", {
      identifier,
      reason: err?.message,
    });
    return { limited: false };
  }
}
