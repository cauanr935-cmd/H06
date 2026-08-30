/**
 * Cliente da API do DocuSeal. `fetch` é injetado para permitir teste sem rede.
 *
 * Regras do projeto:
 * - o `X-Auth-Token` nunca sai daqui para o cliente;
 * - corpo de erro do upstream vai só para `console.error`, nunca propagado;
 * - timeout de 15s via `AbortSignal.timeout`.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/** Erro genérico de upstream. A mensagem nunca carrega o corpo bruto do DocuSeal. */
export class UpstreamError extends Error {
  constructor(reason) {
    super(`docuseal upstream: ${reason}`);
    this.name = "UpstreamError";
  }
}

/**
 * @param {{ nome_completo: string } & Record<string, string>} values
 */
function buildPayload({ templateId, role, origem }, input) {
  const { name, phoneE164, phoneDisplay, email, leadId, extraValues } = input;

  const values = {
    nome_completo: name,
    telefone: phoneDisplay,
  };
  if (email) values.email = email;
  for (const [key, val] of Object.entries(extraValues ?? {})) {
    if (key !== "nome_completo" && key !== "telefone") values[key] = val;
  }

  return {
    template_id: Number(templateId),
    send_email: false,
    send_sms: false,
    submitters: [
      {
        name,
        role,
        external_id: leadId,
        metadata: {
          telefone_e164: phoneE164,
          email: email ?? null,
          origem,
        },
        values,
      },
    ],
  };
}

/** A resposta pode ser um array de submitters ou `{ submitters: [...] }`. */
function firstSubmitter(body) {
  if (Array.isArray(body)) return body[0];
  if (body && Array.isArray(body.submitters)) return body.submitters[0];
  return undefined;
}

/**
 * Cria a submission e devolve o formulário de assinatura do primeiro submitter.
 *
 * @param {{ fetch: typeof fetch, baseUrl: string, token: string, templateId: string,
 *           role: string, origem: string, timeoutMs?: number }} deps
 * @param {{ name: string, phoneE164: string, phoneDisplay: string, email: string | null,
 *           leadId: string, extraValues?: Record<string, string> }} input
 * @returns {Promise<{ slug: string, embed_src: string }>}
 */
export async function createSubmission(deps, input) {
  const { fetch: fetchImpl, baseUrl, token, timeoutMs = DEFAULT_TIMEOUT_MS } = deps;
  const payload = buildPayload(deps, input);

  let res;
  try {
    res = await fetchImpl(`${baseUrl}/api/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Auth-Token": token,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    console.error("[docuseal] falha de rede/timeout ao criar submission:", err?.name, err?.message);
    throw new UpstreamError("request failed");
  }

  const rawText = await res.text().catch(() => "");

  if (!res.ok) {
    console.error(`[docuseal] HTTP ${res.status} ao criar submission. corpo:`, rawText.slice(0, 1000));
    throw new UpstreamError(`http ${res.status}`);
  }

  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    console.error("[docuseal] resposta 2xx não-JSON:", rawText.slice(0, 1000));
    throw new UpstreamError("non-json response");
  }

  const submitter = firstSubmitter(body);
  if (!submitter || !submitter.slug) {
    console.error("[docuseal] resposta sem submitter/slug:", rawText.slice(0, 1000));
    throw new UpstreamError("empty response");
  }

  return {
    slug: submitter.slug,
    embed_src: submitter.embed_src || `${baseUrl}/s/${submitter.slug}`,
  };
}
