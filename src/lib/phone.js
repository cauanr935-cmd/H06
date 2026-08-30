/**
 * Normalização de telefone brasileiro.
 *
 * A LP coleta no formato que o produtor digita — `(11) 99999-8888`, `11999998888`,
 * às vezes já com `+55`. O DocuSeal precisa do E.164 no `metadata`/`external_id`,
 * e o documento (campo Texto, lido por humanos) recebe o formato brasileiro.
 * Nenhuma dependência: o tipo de campo `Telefone` do DocuSeal é recurso pago,
 * então a validação vive aqui.
 */

/** Extrai só os dígitos de uma entrada arbitrária. */
function digits(input) {
  return String(input ?? "").replace(/\D/g, "");
}

/**
 * Converte telefone brasileiro para E.164 (`+55DDNNNNNNNN`).
 * Aceita celular (11 díg. locais) e fixo (10 díg. locais), com ou sem DDI 55.
 * Retorna `null` para qualquer coisa fora desses formatos (ex.: sem DDD).
 */
export function toE164BR(input) {
  const d = digits(input);
  if (d.length === 13 && d.startsWith("55")) return `+${d}`; // 55 + DDD + 9 dígitos
  if (d.length === 12 && d.startsWith("55")) return `+${d}`; // 55 + DDD + fixo
  if (d.length === 11) return `+55${d}`; // DDD + celular
  if (d.length === 10) return `+55${d}`; // DDD + fixo
  return null;
}

/**
 * Máscara progressiva para input controlado — formata o que já foi digitado,
 * sem exigir o número completo. Nunca retorna `null` (diferente de `toDisplayBR`).
 */
export function maskInputBR(raw) {
  const d = digits(raw).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Formata telefone brasileiro para exibição/documento:
 * celular → `(11) 99999-8888`, fixo → `(11) 3333-4444`.
 * Retorna `null` se não der para reconhecer DDD + número.
 */
export function toDisplayBR(input) {
  let d = digits(input);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    d = d.slice(2);
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return null;
}
