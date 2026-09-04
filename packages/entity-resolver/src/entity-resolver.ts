// PH06-T004 — orquestador. Objetivo del packet: "Determinar identidad
// jerárquica con confidence y conflictos explícitos". Combina, en orden de
// prioridad (evita el error "resolver por string similarity solamente"):
//
//   1. Legal identifier match (acción 2) — el más fuerte, casi concluyente.
//   2. Relación de ownership explícita (acción 4) — liga el grupo común de
//      una multinacional cruzando países a propósito (criterio
//      "Multinacional conserva grupo común").
//   3. Nombre + ubicación compatible (acciones 1+3) — el más débil; se
//      descarta de plano si hay conflicto de país explícito (criterio
//      "No mezcla San José CR/US/Belize" y prueba "Same name different
//      company").
//
// Acción 6 ("Escalar ambigüedad") y criterio "Confidence bajo no
// auto-confirma": el resultado nunca es `RESOLVED` si la confianza queda
// por debajo de `ESCALATION_THRESHOLD`, si la ubicación quedó `AMBIGUOUS`,
// o si hubo un empate real entre dos candidatos de nombre — en esos casos
// el status es `NEEDS_REVIEW` y los conflictos quedan listados de forma
// explícita, nunca silenciados dentro de una confianza inflada.

import { applyConflictPenalties, combineConfidence } from './confidence.js';
import { matchByLegalIdentifier, matchByNameAndLocation } from './entity-matcher.js';
import { resolveLocation } from './location-resolver.js';
import { detectRelationship } from './relationship-resolver.js';
import {
  EntityResolutionResultSchema,
  type EntityResolutionInput,
  type EntityResolutionResult,
} from './schema.js';

export const ESCALATION_CONFIDENCE_THRESHOLD = 0.55;

const pickResolvedName = (input: EntityResolutionInput): string => {
  const byPreference = [...input.names].sort((a, b) => {
    const rank = (kind: (typeof a)['kind']): number => (kind === 'LEGAL' ? 0 : kind === 'TRADE' ? 1 : 2);
    const rankDiff = rank(a.kind) - rank(b.kind);
    return rankDiff !== 0 ? rankDiff : b.confidence - a.confidence;
  });
  return byPreference[0]!.name;
};

export const resolveCompanyEntity = (input: EntityResolutionInput): EntityResolutionResult => {
  const conflicts: string[] = [];
  const resolvedName = pickResolvedName(input);
  const location = resolveLocation(input.locations);

  if (location.status === 'AMBIGUOUS') {
    conflicts.push(`ubicación ambigua: ${location.reason ?? 'sin detalle'}`);
  }

  const relationship = detectRelationship(input.ownership, input.knownEntities);

  const legalMatch = matchByLegalIdentifier(input.legalIdentifiers, input.knownEntities);
  const relationshipMatch = relationship?.matchedGroupId
    ? { known: input.knownEntities.find((known) => known.companyGroupId === relationship.matchedGroupId), confidence: relationship.confidence }
    : undefined;
  const nameMatch = matchByNameAndLocation(input.names, input.knownEntities, location);

  if (nameMatch?.tied) {
    conflicts.push(`el nombre "${resolvedName}" coincide de forma similar con más de un grupo conocido — no se elige uno sin confirmación adicional`);
  }

  let matchedGroupId: string | undefined;
  let matchConfidence: number;
  let matchSource: 'LEGAL_IDENTIFIER' | 'OWNERSHIP' | 'NAME_LOCATION' | 'NONE';

  if (legalMatch) {
    matchedGroupId = legalMatch.known.companyGroupId;
    matchConfidence = legalMatch.confidence;
    matchSource = 'LEGAL_IDENTIFIER';
  } else if (relationshipMatch?.known) {
    matchedGroupId = relationshipMatch.known.companyGroupId;
    matchConfidence = relationshipMatch.confidence;
    matchSource = 'OWNERSHIP';
  } else if (nameMatch && !nameMatch.tied) {
    matchedGroupId = nameMatch.known.companyGroupId;
    matchConfidence = nameMatch.similarity;
    matchSource = 'NAME_LOCATION';
  } else {
    matchConfidence = 0;
    matchSource = 'NONE';
  }

  const nameConfidence = input.names.length > 0 ? Math.max(...input.names.map((name) => name.confidence)) : 0;
  const componentConfidences = [nameConfidence, ...(matchSource === 'NONE' ? [] : [matchConfidence])];
  if (location.status === 'RESOLVED') componentConfidences.push(location.confidence);

  const rawConfidence = combineConfidence(componentConfidences);
  const confidence = applyConflictPenalties(rawConfidence, conflicts.length);

  const isNewGroup = matchedGroupId === undefined;
  const status = confidence < ESCALATION_CONFIDENCE_THRESHOLD || location.status === 'AMBIGUOUS' || (nameMatch?.tied ?? false) ? 'NEEDS_REVIEW' : 'RESOLVED';

  if (status === 'NEEDS_REVIEW' && conflicts.length === 0) {
    conflicts.push(`confianza combinada (${confidence.toFixed(2)}) por debajo del umbral de auto-confirmación (${ESCALATION_CONFIDENCE_THRESHOLD})`);
  }

  return EntityResolutionResultSchema.parse({
    status,
    resolvedName,
    matchedGroupId,
    isNewGroup,
    location,
    relationship,
    confidence,
    conflicts,
  });
};
