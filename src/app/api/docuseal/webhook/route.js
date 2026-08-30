/**
 * POST /api/docuseal/webhook
 *
 * Recebe eventos do DocuSeal (form.completed é a fonte de verdade de que o
 * documento foi assinado — o redirect da LP é só UX, não prova). Valida o
 * segredo compartilhado (header customizado, configurado em Settings →
 * Webhooks → Secret no admin do DocuSeal), loga o evento com PII mascarada
 * e responde 200. Sem persistência própria nesta fase.
 * Só wiring HTTP — a lógica vive em src/lib/.
 */

import { readWebhookConfig } from "../../../../lib/docuseal/config.js";
import { verifySecret, parseEvent, redactSecret } from "../../../../lib/docuseal/webhook.js";
import { maskEmail, maskPhone } from "../../../../lib/mask.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(status, body) {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function POST(request) {
  const cfg = readWebhookConfig();
  if (!cfg.ok) {
    console.error("[docuseal-webhook] configuração incompleta, faltam:", cfg.missing.join(", "));
    return json(500, { error: "server_misconfigured" });
  }

  const received = request.headers.get("x-webhook-secret");
  if (!verifySecret(cfg.config.secret, received)) {
    console.error("[docuseal-webhook] segredo inválido ou ausente", {
      ip: request.headers.get("x-forwarded-for"),
    });
    return json(401, { error: "unauthorized" });
  }

  const rawText = await request.text().catch(() => "");
  const parsed = parseEvent(rawText);
  if (!parsed.ok) {
    return json(400, { error: parsed.error });
  }

  const { eventType, submitterId, submissionId, leadId, status, email, phone } = parsed.data;

  console.log(
    "[docuseal-webhook] evento recebido",
    redactSecret(
      {
        event_type: eventType,
        submitter_id: submitterId,
        submission_id: submissionId,
        lead_id: leadId,
        status,
        email: maskEmail(email),
        phone: maskPhone(phone),
      },
      cfg.config.secret,
    ),
  );

  return json(200, { ok: true });
}
