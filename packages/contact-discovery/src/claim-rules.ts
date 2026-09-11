// PH07-T002 -- reglas de `ClaimRule` (tipo de @rhia/evidence-pipeline,
// deliberadamente agnostico a las reglas concretas -- ver cabecera de
// packages/evidence-pipeline/src/claim-extraction.ts) especificas de
// personas: nombre completo y cargo. Se pasan como `claimRules` a
// `buildEvidenceFromSearchResult` (evidence-pipeline) en vez de duplicar el
// motor de extraccion -- mismo principio de reuso que evidence-pipeline ya
// aplico con `canonicalizeUrl` de search-orchestrator.
//
// Patron cubierto (heuristica v1, misma limitacion documentada que
// evidence-pipeline/claim-extraction.ts): titulos de resultados de busqueda
// con forma "Nombre Completo - Cargo" o "Nombre Completo - Cargo - Empresa",
// formato tipico de directorios profesionales (LinkedIn y similares) que es
// justamente el tipo de fuente que este paquete espera recibir via
// candidate-search.ts.

import type { ClaimRule } from '@rhia/evidence-pipeline';

// Nombre: 2 a 4 palabras que empiezan con mayuscula (incluye acentos),
// seguidas de un separador " - "/" | "/" -- ". No matchea si el "nombre" es
// una sola palabra (evita falsos positivos con titulos genericos de pagina).
const NAME_TITLE_PATTERN =
  /^([A-ZÀ-Ý][a-zà-ÿ'’.-]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ'’.-]+){1,3})\s*[-–|]\s*([^-–|]{3,120})/;

export const contactFullNameRule: ClaimRule = {
  claimType: 'CONTACT_FULL_NAME',
  pattern: NAME_TITLE_PATTERN,
  toObservedValue: (match) => ({ fullName: (match[1] ?? '').trim() }),
};

export const contactJobTitleRule: ClaimRule = {
  claimType: 'CONTACT_JOB_TITLE',
  pattern: NAME_TITLE_PATTERN,
  toObservedValue: (match) => {
    const rest = (match[2] ?? '').trim();
    // Si el resto trae otro separador ("Cargo - Empresa"), el cargo es solo
    // el primer segmento -- nunca se incluye el nombre de la empresa como
    // parte del titulo (evitaria contaminar el matching de area/keyword).
    const [titlePart] = rest.split(/[-–|]/);
    return { titleGuess: (titlePart ?? rest).trim() };
  },
};

export const CONTACT_CLAIM_RULES: readonly ClaimRule[] = [contactFullNameRule, contactJobTitleRule];
