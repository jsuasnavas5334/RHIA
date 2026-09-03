// PH06-T003, acción 4 ("Extraer claims"): heurística v1 basada en patrones
// regex sobre título+snippet de un resultado de búsqueda. NO es NLP/IE real
// (no hay modelo de lenguaje involucrado en este packet — eso es AI Gateway
// / model-router, PH05, orquestado desde fuera de este paquete puro) — se
// documenta como limitación conocida y deliberada: mejor pocos claims
// extraídos con alta precisión por regla explícita que "fingir" extracción
// semántica. Reglas nuevas se agregan a `DEFAULT_CLAIM_RULES` sin tocar el
// motor (`extractClaims`), que es agnóstico a las reglas concretas.

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
