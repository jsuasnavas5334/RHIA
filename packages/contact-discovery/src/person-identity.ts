// PH07-T002, accion 3 ("Resolver identidad personal") -- combina un
// `CandidateSearchHit` con las reglas de claim-rules.ts (via
// `buildEvidenceFromSearchResult` de @rhia/evidence-pipeline, reusado sin
// duplicar logica de canonicalizacion de URL/reliability/hash de excerpt)
// para producir: nombre, cargo, confianza de identidad, estado de frescura
// del cargo (`titleStatus`) y la evidencia real que lo sostiene.
//
// "Stale title test" (Pruebas requeridas del packet): un cargo encontrado en
// una fuente vieja no debe tratarse como vigente -- reusa
// `isStaleEvidence` de evidence-pipeline (misma funcion, mismo umbral por
// dias, sin reimplementar el calculo de antiguedad) en vez de inventar un
// segundo criterio de "viejo" para personas.

import { randomUUID } from 'node:crypto';
import { buildEvidenceFromSearchResult, isStaleEvidence, type Evidence, type EvidenceSource } from '@rhia/evidence-pipeline';
import { CONTACT_CLAIM_RULES } from './claim-rules.js';
import type { CandidateSearchHit, TitleStatus } from './schema.js';

// Los cargos cambian con mas frecuencia que hechos estructurales de una
// empresa (evidence-pipeline usa 365 dias por defecto para claims de
// compania) -- 270 dias (9 meses) es un umbral mas conservador,
// documentado aqui como heuristica v1 explicita, no un dato de dominio
// verificado.
export const DEFAULT_TITLE_STALE_AFTER_DAYS = 270;

export type ResolvePersonIdentityInput = Readonly<{
  organizationId: string;
  hit: CandidateSearchHit;
  sourceType: EvidenceSource['sourceType'];
  /** Momento en que se obtuvo el resultado (ver BuildEvidenceInput.fetchedAt en evidence-pipeline). */
  fetchedAt: string;
  now?: Date;
  staleAfterDays?: number;
  newId?: () => string;
}>;

export type ResolvedPersonIdentity = Readonly<{
  fullNameGuess: string | null;
  titleGuess: string | null;
  identityConfidence: number;
  titleStatus: TitleStatus;
  evidence: Evidence[];
}>;

export const resolvePersonIdentity = (input: ResolvePersonIdentityInput): ResolvedPersonIdentity => {
  const newId = input.newId ?? randomUUID;
  const now = input.now ?? new Date();
  const staleAfterDays = input.staleAfterDays ?? DEFAULT_TITLE_STALE_AFTER_DAYS;

  const { source, evidence } = buildEvidenceFromSearchResult({
    organizationId: input.organizationId,
    subjectType: 'CONTACT_CANDIDATE',
    subjectId: newId(),
    result: input.hit,
    sourceType: input.sourceType,
    fetchedAt: input.fetchedAt,
    claimRules: CONTACT_CLAIM_RULES,
    newId,
  });

  const nameEvidence = evidence.find((item) => item.claimType === 'CONTACT_FULL_NAME');
  const titleEvidence = evidence.find((item) => item.claimType === 'CONTACT_JOB_TITLE');

  const fullNameGuess = nameEvidence
    ? ((nameEvidence.observedValue as { fullName?: string }).fullName ?? null)
    : null;
  const titleGuess = titleEvidence
    ? ((titleEvidence.observedValue as { titleGuess?: string }).titleGuess ?? null)
    : null;

  // Sin ningun claim extraido no hay identidad que resolver -- nunca se
  // inventa una confianza positiva sobre datos que no se encontraron
  // (mismo principio que evidence-pipeline: "sin claims -> sin evidencia").
  if (!nameEvidence && !titleEvidence) {
    return { fullNameGuess: null, titleGuess: null, identityConfidence: 0, titleStatus: 'UNKNOWN', evidence: [] };
  }

  const titleStatus: TitleStatus = !titleEvidence
    ? 'UNKNOWN'
    : isStaleEvidence(titleEvidence, now, staleAfterDays)
      ? 'STALE'
      : 'CURRENT';

  // Confianza de identidad: hereda la reliability de la fuente (igual que
  // evidence-pipeline hace con `Evidence.confidence`), pero solo si se
  // encontraron AMBOS (nombre y cargo) -- encontrar solo uno de los dos es
  // una identidad parcial, penalizada a la mitad de la reliability de la
  // fuente en vez de tratarse igual que un match completo.
  const bothFound = Boolean(nameEvidence) && Boolean(titleEvidence);
  const baseConfidence = source.sourceReliability;
  const partialPenalty = bothFound ? 1 : 0.5;
  // Un cargo STALE reduce la confianza de que la identidad siga siendo
  // valida HOY (la persona pudo cambiar de cargo o de empresa) -- no borra
  // la evidencia (se preserva igual, ver `evidence` en el resultado), solo
  // penaliza la confianza y queda explicito en `titleStatus`.
  const stalePenalty = titleStatus === 'STALE' ? 0.5 : 1;
  const identityConfidence = Math.min(1, Math.max(0, baseConfidence * partialPenalty * stalePenalty));

  return { fullNameGuess, titleGuess, identityConfidence, titleStatus, evidence };
};
