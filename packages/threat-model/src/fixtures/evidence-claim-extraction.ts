// Copia textual (byte-a-byte del cuerpo real, solo se agrega este header) de
// `packages/evidence-pipeline/src/claim-extraction.ts` (PH06-T003, ya DONE),
// usada UNICAMENTE para poder ejercer el extractor de claims REAL contra
// texto adversarial en `prompt-injection.test.ts` sin arrastrar la cadena de
// dependencias real de `@rhia/evidence-pipeline` (`@rhia/search-orchestrator`
// -> `@rhia/search-health` + `@rhia/contracts` + `zod`), que en el workspace
// cloud aislado de este ciclo (`device_bash` caido, ver
// docs/progress/PH10-T003.md "Bloqueo de entorno") no se puede compilar ni
// ejecutar: `zod` no esta disponible ni localmente ni via red en este
// contenedor (`403 host_not_allowed` hacia `registry.npmjs.org`, mismo
// bloqueo ya documentado en CLAUDE.md), y copiar tambien `search-orchestrator`
// /`search-health`/`contracts` solo para poder importar una funcion pura sin
// imports propios habria sido desproporcionado.
//
// Decision explicita: NO se reimplementa la logica (eso perderia el valor
// real de la prueba -- estariamos probando un heuristico inventado, no el
// real), se copia literalmente. Si `packages/evidence-pipeline/src/
// claim-extraction.ts` cambia en un ciclo futuro, esta copia debe
// resincronizarse (o, mejor, ese ciclo deberia resolver el bloqueo de red/
// zod y depender del paquete real directamente -- ver "Fuera de alcance" en
// docs/progress/PH10-T003.md).
//
// ---- INICIO copia literal de packages/evidence-pipeline/src/claim-extraction.ts ----

export type ExtractedClaim = Readonly<{
  claimType: string;
  observedValue: unknown;
}>;

export type ClaimRule = Readonly<{
  claimType: string;
  pattern: RegExp;
  /** Construye el `observedValue` estructurado a partir del match. Nunca debe devolver el texto crudo completo. */
  toObservedValue: (match: RegExpMatchArray) => unknown;
}>;

const employeeCountRule: ClaimRule = {
  claimType: 'EMPLOYEE_COUNT',
  pattern: /([\d][\d.,]*)\s*[+]?\s*(employees|empleados|colaboradores)/i,
  toObservedValue: (match) => {
    const raw = match[1] ?? '';
    const numeric = Number(raw.replace(/[.,]/g, ''));
    return Number.isFinite(numeric) ? { count: numeric, unit: 'employees' } : { raw };
  },
};

const foundedYearRule: ClaimRule = {
  claimType: 'FOUNDED_YEAR',
  pattern: /(?:founded|fundada|fundado)\s+(?:in|en)?\s*(\d{4})/i,
  toObservedValue: (match) => ({ year: Number(match[1]) }),
};

const headquartersRule: ClaimRule = {
  claimType: 'HEADQUARTERS_LOCATION',
  pattern: /(?:headquartered in|sede en|con sede en)\s+([A-Za-zÀ-ÿ.\s]{2,80}?)(?:[.,;]|$)/i,
  toObservedValue: (match) => ({ location: (match[1] ?? '').trim() }),
};

export const DEFAULT_CLAIM_RULES: readonly ClaimRule[] = [employeeCountRule, foundedYearRule, headquartersRule];

/**
 * Aplica cada regla una vez sobre `text` (título+snippet ya concatenados
 * por el llamador). Reglas que no matchean simplemente no producen claim —
 * no hay penalización ni error. Si varias reglas matchean, todas aportan
 * (un mismo texto puede mencionar empleados y año de fundación a la vez).
 */
export const extractClaims = (text: string, rules: readonly ClaimRule[] = DEFAULT_CLAIM_RULES): ExtractedClaim[] => {
  const claims: ExtractedClaim[] = [];
  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (!match) continue;
    claims.push({ claimType: rule.claimType, observedValue: rule.toObservedValue(match) });
  }
  return claims;
};

// ---- FIN copia literal ----
