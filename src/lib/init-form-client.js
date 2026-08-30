/**
 * Helper de browser para falar com POST /api/init-form.
 * Puro e testável — sem React, sem DOM. O componente client só orquestra estado.
 */

/** Códigos de erro que o Route Handler devolve em 400, mapeados para campo + texto. */
const MENSAGENS = {
  name_required: { campo: "name", texto: "Informe seu nome completo." },
  phone_required: { campo: "phone", texto: "Informe seu WhatsApp com DDD." },
  invalid_phone: { campo: "phone", texto: "WhatsApp inválido. Use DDD + número." },
  invalid_email: { campo: "email", texto: "E-mail inválido." },
  invalid_json: { campo: null, texto: "Não foi possível enviar o formulário. Tente novamente." },
};

const GENERICA = "Não foi possível iniciar a assinatura agora. Tente novamente em instantes.";

/**
 * @param {string | undefined} error  código no corpo da resposta
 * @param {number | undefined} status HTTP status
 * @returns {{ campo: string | null, texto: string }}
 */
export function mensagemDeErro(error, status) {
  if (status === 429) {
    return { campo: null, texto: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }
  if (error && MENSAGENS[error]) return MENSAGENS[error];
  return { campo: null, texto: GENERICA };
}

/**
 * Envia o lead para /api/init-form.
 *
 * @param {{ name: string, phone: string, email?: string, values?: Record<string, string> }} input
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ ok: true, data: { slug: string, embed_src: string, lead_id: string } }
 *           | { ok: false, error?: string, status?: number }>}
 */
export async function submitLead(input, fetchImpl = fetch) {
  const body = { name: input.name, phone: input.phone };
  if (input.email) body.email = input.email;

  const values = {};
  for (const [k, v] of Object.entries(input.values ?? {})) {
    if (v != null && String(v).trim() !== "") values[k] = String(v).trim();
  }
  if (Object.keys(values).length > 0) body.values = values;

  let res;
  try {
    res = await fetchImpl("/api/init-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false };
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (res.ok && payload?.slug && payload?.embed_src) {
    return { ok: true, data: payload };
  }
  return { ok: false, error: payload?.error, status: res.status };
}
