// PH06-T003, acción 3 ("Clasificar source reliability"): heurística v1,
// pura y determinista, basada en dominio/tipo de fuente. NO es un scoring
// aprendido ni consulta reputación externa (backlinks, antigüedad de
// dominio, etc.) — eso queda fuera de este packet ("evidence service"); se
// documenta aquí como limitación explícita conocida, no se finge una
// capacidad inexistente (Task Packet, PH05-T002 mismo criterio de
// "normalizar sin fingir capacidades inexistentes" aplicado aquí a fuentes).

export type SourceReliabilityInput = Readonly<{
  domain: string;
  sourceType: 'OFFICIAL_WEBSITE' | 'NEWS' | 'DIRECTORY' | 'SOCIAL' | 'GOVERNMENT' | 'UNKNOWN';
}>;

// Etiquetas (labels) de dominio de alta confianza. Se comparan contra CADA
// segmento separado por punto, no solo el TLD final, porque muchos ccTLDs
// gubernamentales/académicos usan un segundo nivel (.gob.cr, .gov.uk,
// .ac.uk) en vez de un TLD propio como .gov/.edu.
const HIGH_TRUST_LABELS = ['gov', 'gob', 'edu', 'ac'];

// Directorios profesionales conocidos: más confiables que la web abierta,
// pero no equivalentes a la fuente oficial de la propia empresa.
const KNOWN_PROFESSIONAL_DIRECTORIES = ['linkedin.com', 'crunchbase.com'];

const BASE_RELIABILITY_BY_SOURCE_TYPE: Record<SourceReliabilityInput['sourceType'], number> = {
  GOVERNMENT: 0.95,
  OFFICIAL_WEBSITE: 0.85,
  NEWS: 0.65,
  DIRECTORY: 0.55,
  SOCIAL: 0.45,
  UNKNOWN: 0.4,
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Clasifica la confiabilidad de una fuente en [0, 1]. Reglas, en orden de
 * prioridad: (1) label de dominio de alta confianza (gov/gob/edu/ac, en
 * cualquier segmento) domina sobre el `sourceType` declarado — un dominio
 * gubernamental sigue siendo alta
 * confianza aunque venga taggeado como NEWS. (2) Directorio profesional
 * conocido (LinkedIn, Crunchbase) sube el piso de DIRECTORY genérico. (3)
 * En cualquier otro caso, el score base por `sourceType`.
 */
export const classifySourceReliability = (input: SourceReliabilityInput): number => {
  const domain = input.domain.trim().toLowerCase();
  const labels = domain.split('.');

  if (labels.some((label) => HIGH_TRUST_LABELS.includes(label))) {
    return 0.95;
  }

  if (KNOWN_PROFESSIONAL_DIRECTORIES.some((known) => domain === known || domain.endsWith(`.${known}`))) {
    return 0.75;
  }

  return clamp01(BASE_RELIABILITY_BY_SOURCE_TYPE[input.sourceType]);
};
