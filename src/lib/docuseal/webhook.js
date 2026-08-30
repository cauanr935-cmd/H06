/**
 * Verificação de segredo e parsing do payload de `POST /api/docuseal/webhook`.
 *
 * Auth: header customizado (não HMAC) — o admin configura em Settings →
 * Webhooks → aba "Secret" do DocuSeal um header arbitrário com o valor de
 * `WEBHOOK_SECRET`. Aqui só comparamos o valor recebido, em tempo constante.
 */

import { timingSafeEqual } from "node:crypto";

/**
 * @param {string} expected
 * @param {string | null | undefined} received
 * @returns {boolean}
 */
export function verifySecret(expected, received) {
  if (!received) return false;

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(received);
  if (expectedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * @param {string} rawText
 * @returns {{ ok: true, data: { eventType: string, submitterId: unknown, submissionId: unknown,
 *             leadId: string | null, status: unknown, email: unknown, phone: unknown } }
 *           | { ok: false, error: "invalid_json" | "invalid_payload" }}
 */
export function parseEvent(rawText) {
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const eventType = payload?.event_type;
  const data = payload?.data;
  if (typeof eventType !== "string" || !eventType || !data || typeof data !== "object") {
    return { ok: false, error: "invalid_payload" };
  }

  return {
    ok: true,
    data: {
      eventType,
      submitterId: data.id ?? null,
      submissionId: data.submission_id ?? null,
      leadId: data.external_id ?? data.application_key ?? null,
      status: data.status ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
    },
  };
}

/**
 * Última linha de defesa antes de logar: se algum campo do payload (que não
 * passa por nenhuma máscara própria, ex.: `status`, `event_type`) vier igual
 * ao segredo do webhook — payload malicioso ou mal-configurado — substitui
 * por um placeholder em vez de ecoar o valor.
 *
 * @param {Record<string, unknown>} fields
 * @param {string} secret
 * @returns {Record<string, unknown>}
 */
export function redactSecret(fields, secret) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = value !== null && value !== undefined && String(value) === secret ? "(redigido)" : value;
  }
  return out;
}

/**
 * Idempotência: DocuSeal reenvia o mesmo evento em caso de falha na entrega
 * (retry com backoff exponencial). Usa `SET key 1 EX ttl NX` no mesmo
 * Upstash Redis do rate limit (`SET ... NX` só grava se a chave não existe
 * — atômico, sem race condition entre checar e marcar). Falha do store
 * nunca bloqueia o webhook: fail-open, processa como se fosse novo.
 *
 * @param {{ fetch: typeof fetch, url: string, token: string }} deps
 * @param {{ key: string, ttlSeconds?: number }} input
 * @returns {Promise<{ alreadyProcessed: boolean }>}
 */
export async function checkAndMarkProcessed(deps, { key, ttlSeconds = 7 * 24 * 60 * 60 }) {
  const { fetch: fetchImpl, url, token } = deps;

  try {
    const res = await fetchImpl(`${url}/set/${encodeURIComponent(key)}/1/EX/${ttlSeconds}/NX`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`set http ${res.status}`);
    const { result } = await res.json();
    return { alreadyProcessed: result === null };
  } catch (err) {
    console.error("[docuseal-webhook] falha ao checar idempotência, processando mesmo assim:", {
      key,
      reason: err?.message,
    });
    return { alreadyProcessed: false };
  }
}
