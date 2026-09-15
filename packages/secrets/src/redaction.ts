// Secrets & Redaction (PH10-T001) -- "Redact logs" (accion 2). Defensa en
// profundidad de 2 capas, mismo espiritu honesto que `looksLikeRawSecret`
// de `@rhia/tool-registry` (heuristico de patrones, no garantia
// matematica, documentado como tal):
//
//   1. Por NOMBRE de campo: cualquier clave que coincida con un nombre
//      sensible conocido (`password`, `token`, `email`, etc.) se redacta
//      SIEMPRE, sin mirar el contenido -- cubre el caso donde el valor no
//      "parece" nada especial pero el campo es sensible por definicion.
//   2. Por CONTENIDO: todo string (incluidos los que sobreviven la capa 1)
//      pasa por patrones reales de secretos/PII embebidos en texto libre
//      (ej. un stack trace o un mensaje de error que incluye un token
//      pegado por accidente) -- error a evitar del packet "Screenshots con
//      credenciales visibles sin redaction" generalizado a CUALQUIER log.
//
// Error a evitar del packet: "Guardar cookies/tokens en DB plana" -- este
// modulo es para LOGS, no reemplaza el cifrado real de `encryption.ts`
// para datos que SI deben persistirse (contact points).

export const defaultSensitiveKeyNames = [
  'password',
  'passwd',
  'secret',
  'secrets',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'api_key',
  'credentialref',
  'authorization',
  'cookie',
  'cookies',
  'privatekey',
  'phone',
  'phonenumber',
  'email',
] as const;

// Orden deliberado: patrones de secretos estructurados primero (para que
// `[REDACTED_SECRET]` gane sobre una coincidencia parcial de email/telefono
// dentro del mismo token), luego email, luego telefono.
const BEARER_PATTERN = /\bbearer\s+[a-z0-9._-]{8,}/gi;
const AWS_KEY_PATTERN = /AKIA[0-9A-Z]{16}/g;
const OPENAI_KEY_PATTERN = /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g;
const JWT_PATTERN = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;

/**
 * Redacta secretos/PII embebidos dentro de texto libre (capa 2). Nunca
 * lanza -- un string sin coincidencias vuelve identico.
 */
export const redactText = (text: string): string =>
  text
    .replace(BEARER_PATTERN, '[REDACTED_SECRET]')
    .replace(AWS_KEY_PATTERN, '[REDACTED_SECRET]')
    .replace(OPENAI_KEY_PATTERN, '[REDACTED_SECRET]')
    .replace(JWT_PATTERN, '[REDACTED_SECRET]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]');

/**
 * Redacta un valor arbitrario (tipicamente el payload que un logger esta a
 * punto de escribir) de forma recursiva y segura ante ciclos. `sensitiveKeyNames`
 * se compara case-insensitive contra cada clave de objeto (capa 1); todo
 * string restante pasa por `redactText` (capa 2).
 */
export const redactValue = (
  value: unknown,
  sensitiveKeyNames: readonly string[] = defaultSensitiveKeyNames,
  seen: WeakSet<object> = new WeakSet(),
): unknown => {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, sensitiveKeyNames, seen));
  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) return '[REDACTED_CIRCULAR]';
    seen.add(value);
    const lowerSensitive = new Set(sensitiveKeyNames.map((name) => name.toLowerCase()));
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      if (lowerSensitive.has(key.toLowerCase())) {
        result[key] = entryValue === '' ? '' : '[REDACTED]';
      } else {
        result[key] = redactValue(entryValue, sensitiveKeyNames, seen);
      }
    }
    return result;
  }
  return value;
};
