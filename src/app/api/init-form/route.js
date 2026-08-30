/**
 * POST /api/init-form
 *
 * Recebe { name, phone, email?, values? } da LP, cria a submission no DocuSeal e
 * devolve { slug, embed_src, lead_id } para o front redirecionar o usuário
 * (mesma aba) até o formulário de assinatura em embed_src.
 * Só wiring HTTP — a lógica vive em src/lib/.
 */

import { randomUUID } from "node:crypto";

import { readConfig } from "../../../lib/docuseal/config.js";
import { parseBody, validate } from "../../../lib/docuseal/validate.js";
import { createSubmission } from "../../../lib/docuseal/client.js";
import { maskEmail, maskPhone } from "../../../lib/mask.js";
import { readRateLimitConfig, getClientIp, checkRateLimit } from "../../../lib/rate-limit.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(status, body, extraHeaders = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

export async function POST(request) {
  const rlCfg = readRateLimitConfig();
  if (rlCfg.ok) {
    const ip = getClientIp(request);
    const { limited, retryAfterSeconds } = await checkRateLimit(
      { fetch: globalThis.fetch, ...rlCfg.config },
      { identifier: ip },
    );
    if (limited) {
      console.error("[init-form] rate limit excedido", { ip });
      return json(429, { error: "too_many_requests" }, { "Retry-After": String(retryAfterSeconds) });
    }
  } else {
    console.error("[init-form] rate limit desabilitado, faltam:", rlCfg.missing.join(", "));
  }

  const cfg = readConfig();
  if (!cfg.ok) {
    console.error("[init-form] configuração incompleta, faltam:", cfg.missing.join(", "));
    return json(500, { error: "server_misconfigured" });
  }

  const rawText = await request.text().catch(() => "");
  const parsed = parseBody(rawText);
  if (!parsed.ok) {
    return json(400, { error: parsed.error });
  }

  const result = validate(parsed.value);
  if (!result.ok) {
    return json(400, { error: result.error });
  }

  const leadId = randomUUID();
  const { name, phoneE164, phoneDisplay, email, extraValues } = result.data;

  try {
    const { slug, embed_src } = await createSubmission(
      { fetch: globalThis.fetch, ...cfg.config },
      { name, phoneE164, phoneDisplay, email, leadId, extraValues },
    );

    console.log("[init-form] submission criada", {
      lead_id: leadId,
      phone: maskPhone(phoneE164),
      email: maskEmail(email),
      extra: Object.keys(extraValues),
    });

    return json(200, { slug, embed_src, lead_id: leadId });
  } catch (err) {
    console.error("[init-form] upstream falhou", {
      lead_id: leadId,
      phone: maskPhone(phoneE164),
      reason: err?.message,
    });
    return json(502, { error: "upstream_error" });
  }
}
