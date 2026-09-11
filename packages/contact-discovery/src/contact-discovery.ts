// PH07-T002 -- orquestador que combina las 5 acciones del packet:
//   1. Derivar personas objetivo por use case  -> role-derivation.ts
//   2. Buscar candidatos                       -> candidate-search.ts (queries; el llamador ejecuta la busqueda real)
//   3. Resolver identidad personal              -> person-identity.ts
//   4. Vincular company/entity                  -> company-linking.ts (guard obligatorio)
//   5. Guardar provenance                       -> Evidence[] de @rhia/evidence-pipeline, devuelto junto al resultado
//
// Recibe los resultados de busqueda YA ejecutados por el llamador (mismo
// patron que evidence-pipeline/entity-resolver: un paquete puro no hace
// dispatch de red) -- lo que este paquete garantiza es que, sea cual sea el
// origen de esos resultados, NINGUN candidato se construye sin
// `companyGroupId` (la garantia se verifica ANTES de procesar ningun hit,
// no candidato por candidato) y que la prioridad de cada candidato refleja
// el area relevante para ESE caso de uso, no una lista global de cargos.

import { randomUUID } from 'node:crypto';
import type { Evidence, EvidenceSource } from '@rhia/evidence-pipeline';
import { assertCompanyLinkage } from './company-linking.js';
import { deriveTargetRoles, matchRoleAreaForTitle } from './role-derivation.js';
import { resolvePersonIdentity } from './person-identity.js';
import {
  ContactCandidateSchema, ContactDiscoveryResultSchema,
  type CandidateSearchHit, type ContactCandidate, type ContactDiscoveryResult, type UseCaseContext,
} from './schema.js';

export type DiscoveredHit = Readonly<{
  hit: CandidateSearchHit;
  sourceType: EvidenceSource['sourceType'];
  /** Momento en que se obtuvo este hit (ver BuildEvidenceInput.fetchedAt en evidence-pipeline). */
  fetchedAt: string;
}>;

export type DiscoverContactsInput = Readonly<{
  organizationId: string;
  company: Readonly<{
    companyGroupId: string | null | undefined;
    companyEntityId?: string | null;
    canonicalName: string;
  }>;
  useCase: UseCaseContext;
  hits: readonly DiscoveredHit[];
  now?: Date;
  staleAfterDays?: number;
  newId?: () => string;
}>;

export type DiscoverContactsOutput = Readonly<{
  result: ContactDiscoveryResult;
  /** Evidencia real (misma forma que evidence-pipeline) que sostiene cada `supportingEvidenceIds` de `result.candidates`. */
  evidence: Evidence[];
}>;

/**
 * Lanza `MissingCompanyLinkageError` (company-linking.ts) si
 * `input.company.companyGroupId` esta ausente -- ANTES de procesar
 * cualquier hit. Es la garantia real (no solo de tipos) del criterio de
 * aceptacion "No crea contacto sin company linkage": ni siquiera se derivan
 * roles o se resuelve identidad si no hay una compania ya vinculada.
 */
export const discoverContacts = (input: DiscoverContactsInput): DiscoverContactsOutput => {
  const { companyGroupId, companyEntityId } = assertCompanyLinkage(input.company);
  const newId = input.newId ?? randomUUID;
  const now = input.now ?? new Date();

  const roles = deriveTargetRoles(input.useCase);
  const allEvidence: Evidence[] = [];

  const candidates: ContactCandidate[] = input.hits.map(({ hit, sourceType, fetchedAt }) => {
    const identity = resolvePersonIdentity({
      organizationId: input.organizationId,
      hit,
      sourceType,
      fetchedAt,
      now,
      newId,
      ...(input.staleAfterDays !== undefined ? { staleAfterDays: input.staleAfterDays } : {}),
    });
    allEvidence.push(...identity.evidence);

    const roleArea = matchRoleAreaForTitle(identity.titleGuess, roles);
    const roleArchetype = roles.find((role) => role.area === roleArea);
    const rolePriority = roleArchetype?.priority ?? 0;
    // Prioridad final: promedio de "que tan relevante es esta area para el
    // caso de uso" y "que tan confiable es la identidad extraida" -- un
    // candidato con cargo perfecto para el area pero identidad de baja
    // confianza (o STALE, ya reflejado en identityConfidence) no debe
    // superar a uno con ambas senales fuertes.
    const priority = Math.min(1, Math.max(0, (rolePriority + identity.identityConfidence) / 2));

    return ContactCandidateSchema.parse({
      id: newId(),
      organizationId: input.organizationId,
      companyGroupId,
      companyEntityId,
      fullNameGuess: identity.fullNameGuess,
      titleGuess: identity.titleGuess,
      roleArea,
      priority,
      identityConfidence: identity.identityConfidence,
      titleStatus: identity.titleStatus,
      sourceUrl: hit.url,
      supportingEvidenceIds: identity.evidence.map((item) => item.id),
    });
  });

  const sortedCandidates = [...candidates].sort((a, b) => b.priority - a.priority);

  const result = ContactDiscoveryResultSchema.parse({
    organizationId: input.organizationId,
    companyGroupId,
    roles,
    candidates: sortedCandidates,
    generatedAt: now.toISOString(),
  });

  return { result, evidence: allEvidence };
};
