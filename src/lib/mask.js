/**
 * Mascaramento de PII para log. Nunca logamos e-mail, telefone ou token crus.
 * Regra inviolável do projeto: e-mail sempre mascarado, payload/segredo nunca.
 */

/**
 * `teste@exemplo.com` → `t***@exemplo.com`.
 * Falsy / sem `@` → `"(vazio)"` / `"(invalido)"` — nunca ecoa o valor recebido.
 */
export function maskEmail(email) {
  if (!email) return "(vazio)";
  const str = String(email);
  const at = str.indexOf("@");
  if (at < 1) return "(invalido)";
  return `${str[0]}***${str.slice(at)}`;
}

/**
 * `+5511999998888` → `+55 11 *****-8888` (mantém só os 4 últimos dígitos).
 * Falsy → `"(vazio)"`. Curto demais → `"***"`.
 */
export function maskPhone(phone) {
  if (!phone) return "(vazio)";
  const d = String(phone).replace(/\D/g, "");
  if (d.length < 6) return "***";
  const last4 = d.slice(-4);
  const ddd = d.length >= 12 ? d.slice(2, 4) : d.slice(0, 2);
  return `+55 ${ddd} *****-${last4}`;
}
