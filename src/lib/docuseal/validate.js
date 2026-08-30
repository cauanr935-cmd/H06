/**
 * Parsing e validação do corpo de `POST /api/init-form`.
 *
 * Contrato de entrada: { name: string, phone: string, email?: string, values?: object }
 * `phone` é obrigatório (identificador principal); `email` é opcional e só é
 * validado se vier preenchido. `values` do cliente passa por allowlist — os
 * campos que ligam o lead ao documento (`nome_completo`, `telefone`) são
 * montados pelo servidor e nunca aceitos do cliente.
 */

import { toE164BR, toDisplayBR } from "../phone.js";

const NAME_MAX = 120;

// e-mail: exige `@`, um ponto depois do `@` (TLD) e nenhum espaço.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Campos do template que a LP pode pré-preencher via `values`. Qualquer chave
 * fora desta lista é descartada em silêncio. Ver `documentos/TEMPLATE-DOCUSEAL.md`.
 */
export const CAMPOS_PERMITIDOS = ["municipio_uf", "area_hectares", "car", "qualidade"];

/**
 * @param {string} rawText
 * @returns {{ ok: true, value: unknown } | { ok: false, error: "invalid_json" }}
 */
export function parseBody(rawText) {
  try {
    return { ok: true, value: JSON.parse(rawText) };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

function pickAllowed(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  const out = {};
  for (const key of CAMPOS_PERMITIDOS) {
    if (values[key] !== undefined && values[key] !== null && String(values[key]).trim() !== "") {
      out[key] = String(values[key]).trim();
    }
  }
  return out;
}

/**
 * @param {unknown} payload
 * @returns {{ ok: true, data: { name: string, phoneE164: string, phoneDisplay: string,
 *             email: string | null, extraValues: Record<string, string> } }
 *           | { ok: false, error: "name_required" | "phone_required" | "invalid_phone" | "invalid_email" }}
 */
export function validate(payload) {
  const src = payload && typeof payload === "object" ? payload : {};

  const name = String(src.name ?? "").trim().slice(0, NAME_MAX);
  if (!name) return { ok: false, error: "name_required" };

  const phoneRaw = String(src.phone ?? "").trim();
  if (!phoneRaw) return { ok: false, error: "phone_required" };

  const phoneE164 = toE164BR(phoneRaw);
  const phoneDisplay = toDisplayBR(phoneRaw);
  if (!phoneE164 || !phoneDisplay) return { ok: false, error: "invalid_phone" };

  const emailNorm = String(src.email ?? "").trim().toLowerCase();
  let email = null;
  if (emailNorm) {
    if (!EMAIL_RE.test(emailNorm)) return { ok: false, error: "invalid_email" };
    email = emailNorm;
  }

  return {
    ok: true,
    data: { name, phoneE164, phoneDisplay, email, extraValues: pickAllowed(src.values) },
  };
}
