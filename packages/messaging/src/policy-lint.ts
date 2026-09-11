// Messaging (PH08-T003), accion 4 ("Policy lint"), criterios "No ofrece
// descuento" / "No afirma dato sin soporte" y error a evitar "Inventar
// urgencia falsa". `lintMessage` es un guardia INDEPENDIENTE de
// `generate.ts` -- audita cualquier texto de mensaje (generado por este
// paquete o escrito a mano) contra el `ContextPack`, no confia en que el
// generador se haya comportado bien. Es deliberadamente conservador: ante
// la duda, marca el issue (mejor un falso positivo que revisar un humano,
// nunca un mensaje con un dato inventado o una oferta no autorizada
// saliendo sin marca).
//
// Nota de diseno (evita duplicar `@rhia/evidence-pipeline`, decision
// documentada): la deteccion de "claim numerico" aqui usa SU PROPIO patron
// de palabras clave (empleados/employees, fundado/founded) en vez de
// importar `extractClaims`/`DEFAULT_CLAIM_RULES` como VALOR de
// `@rhia/evidence-pipeline` -- ese import de valor ejecutaria en runtime
// `schema.js` de ese paquete, que a su vez requiere `zod` real (4.4.3) y
// `@rhia/contracts`; este entorno cloud solo tiene disponible zod 3.25.76
// de forma transitiva (ver schema.ts de este paquete) y no hay red para
// instalar la version real. Usar esa version distinta en runtime (no solo
// en tipos) arriesgaria un comportamiento sutilmente distinto al de
// produccion -- se prefirio un guardia local, pequeño y auditable, sobre
// arrastrar una dependencia de runtime con version incierta a un paquete
// puro. Se documenta como limitacion conocida, no como decision de diseno
// permanente.

import type { ContextPack } from './context-pack.js';
import type { GeneratedMessage } from './generate.js';

export type PolicyLintIssueCode = 'PRICE_OR_DISCOUNT' | 'UNSUPPORTED_CLAIM' | 'FALSE_URGENCY' | 'MISSING_OPT_OUT';

export type PolicyLintIssue = Readonly<{
  code: PolicyLintIssueCode;
  message: string;
}>;

export type PolicyLintResult = Readonly<{
  passed: boolean;
  issues: readonly PolicyLintIssue[];
}>;

const PRICE_OR_DISCOUNT_PATTERN = /(\bdescuento\b|\boferta especial\b|\bprecio especial\b|\d+\s*%\s*(off|de descuento)|\$\s?\d|\busd\s?\d|\bgratis\b|\bfree\b\s+(trial|price)|\bdiscount\b)/i;

const FALSE_URGENCY_PATTERN = /(solo hoy|ultima oportunidad|por tiempo limitado|no te lo pierdas|cupos limitados|last chance|limited time|act now|apurate)/i;

const OPT_OUT_PATTERN = /(dar(?:te|se)?\s+de\s+baja|unsubscribe|dejar de recibir|no continuar recibiendo|opt[- ]?out|"stop"|"no")/i;

const EMPLOYEE_CLAIM_PATTERN = /([\d][\d.,]*)\s*[+]?\s*(empleados|employees|colaboradores)/gi;
const FOUNDED_CLAIM_PATTERN = /(?:fundo|fundada|fundado|founded)\s+(?:en|in)?\s*(\d{4})/gi;

const hasMatchingFact = (contextPack: ContextPack, predicate: string, matches: (value: unknown) => boolean): boolean =>
  contextPack.facts.some((fact) => fact.predicate === predicate && matches(fact.value));

const findUnsupportedNumericClaims = (text: string, contextPack: ContextPack): string[] => {
  const unsupported: string[] = [];

  for (const match of text.matchAll(EMPLOYEE_CLAIM_PATTERN)) {
    const claimed = Number((match[1] ?? '').replace(/[.,]/g, ''));
    if (!Number.isFinite(claimed)) continue;
    const supported = hasMatchingFact(
      contextPack,
      'EMPLOYEE_COUNT',
      (value) => typeof value === 'object' && value !== null && (value as Record<string, unknown>)['count'] === claimed,
    );
    if (!supported) unsupported.push(match[0]);
  }

  for (const match of text.matchAll(FOUNDED_CLAIM_PATTERN)) {
    const claimedYear = Number(match[1]);
    if (!Number.isFinite(claimedYear)) continue;
    const supported = hasMatchingFact(
      contextPack,
      'FOUNDED_YEAR',
      (value) => typeof value === 'object' && value !== null && (value as Record<string, unknown>)['year'] === claimedYear,
    );
    if (!supported) unsupported.push(match[0]);
  }

  return unsupported;
};

export const lintMessage = (
  message: Readonly<{ subject: string | null; body: string }>,
  contextPack: ContextPack,
): PolicyLintResult => {
  const fullText = `${message.subject ?? ''}\n${message.body}`;
  const issues: PolicyLintIssue[] = [];

  if (PRICE_OR_DISCOUNT_PATTERN.test(fullText)) {
    issues.push({ code: 'PRICE_OR_DISCOUNT', message: 'El mensaje menciona precio/descuento -- Messaging nunca ofrece condiciones comerciales.' });
  }

  const unsupported = findUnsupportedNumericClaims(fullText, contextPack);
  if (unsupported.length > 0) {
    issues.push({
      code: 'UNSUPPORTED_CLAIM',
      message: `El mensaje afirma un dato sin soporte en el ContextPack: ${unsupported.join(', ')}.`,
    });
  }

  if (FALSE_URGENCY_PATTERN.test(fullText)) {
    issues.push({ code: 'FALSE_URGENCY', message: 'El mensaje usa lenguaje de urgencia que no esta respaldado por ningun fact/inference del ContextPack.' });
  }

  if (!OPT_OUT_PATTERN.test(fullText)) {
    issues.push({ code: 'MISSING_OPT_OUT', message: 'El mensaje no incluye una clausula de opt-out reconocible.' });
  }

  return { passed: issues.length === 0, issues };
};

/** Conveniencia: lint directo sobre la salida de `generateMessage`. */
export const lintGeneratedMessage = (generated: GeneratedMessage, contextPack: ContextPack): PolicyLintResult =>
  lintMessage({ subject: generated.subject, body: generated.body }, contextPack);
