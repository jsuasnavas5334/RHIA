// PH06-T003 — combina las acciones 1, 2, 3 y 5 del Task Packet
// (canonicalizar URL, hash excerpt, clasificar reliability, guardar
// freshness) para convertir UN resultado de búsqueda (mismo shape que
// `SearchResponseSchema.results[number]` de @rhia/contracts, producido por
// `orchestrateSearch` en PH06-T002) en cero o más registros de evidencia.
// Reutiliza `canonicalizeUrl` de @rhia/search-orchestrator (no se duplica
// la lógica de normalización de URL, ya probada en PH06-T002).

import { randomUUID } from 'node:crypto';
import { canonicalizeUrl } from '@rhia/search-orchestrator';
import { DEFAULT_CLAIM_RULES, extractClaims, type ClaimRule } from './claim-extraction.js';
import { hashExcerpt } from './excerpt-hash.js';
import { classifySourceReliability } from './source-reliability.js';
import { EvidenceSchema, EvidenceSourceSchema, type Evidence, type EvidenceSource } from './schema.js';

export type SearchResultLike = Readonly<{
  url: string;
  title: string;
  snippet: string;
  provider: string;
}>;

export type BuildEvidenceInput = Readonly<{
  organizationId: string;
  subjectType: string;
  subjectId: string;
  result: SearchResultLike;
  sourceType: EvidenceSource['sourceType'];
  /** Momento en que se obtuvo el resultado (normalmente `SearchResponse.completedAt`). */
  fetchedAt: string;
  claimRules?: readonly ClaimRule[];
  newId?: () => string;
}>;

export type BuildEvidenceOutput = Readonly<{
  source: EvidenceSource;
  /** Vacío si el texto no matchea ninguna regla de `claim-extraction.ts` — nunca se inventa un claim. */
  evidence: Evidence[];
}>;

const hostnameOf = (canonicalUrl: string): string => {
  try {
    return new URL(canonicalUrl).hostname;
  } catch {
    return canonicalUrl;
  }
};

/**
 * Nunca guarda `result.title`/`result.snippet` crudos en el registro
 * devuelto — solo su `excerptHash` (ver excerpt-hash.ts) y el
 * `observedValue` estructurado que produjo cada claim, conforme al error a
 * evitar "guardar texto entero sin necesidad" del Task Packet.
 */
export const buildEvidenceFromSearchResult = (input: BuildEvidenceInput): BuildEvidenceOutput => {
  const newId = input.newId ?? randomUUID;
  const canonicalUrl = canonicalizeUrl(input.result.url);
  const domain = hostnameOf(canonicalUrl);
  const sourceReliability = classifySourceReliability({ domain, sourceType: input.sourceType });

  const source = EvidenceSourceSchema.parse({
    id: newId(),
    organizationId: input.organizationId,
    sourceType: input.sourceType,
    domain,
    url: canonicalUrl,
    fetchedAt: input.fetchedAt,
    provider: input.result.provider,
    sourceReliability,
  });

  const text = `${input.result.title} ${input.result.snippet}`.trim();
  const claims = extractClaims(text, input.claimRules ?? DEFAULT_CLAIM_RULES);
  const excerptHash = hashExcerpt(text);

  const evidence = claims.map((claim) =>
    EvidenceSchema.parse({
      id: newId(),
      organizationId: input.organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      sourceId: source.id,
      claimType: claim.claimType,
      excerptHash,
      observedValue: claim.observedValue,
      // v1: la confianza de la evidencia hereda la reliability de su
      // fuente (simplificación documentada; un scoring propio por claim
      // -p. ej. penalizar coincidencias parciales de regex- queda fuera de
      // este packet).
      confidence: sourceReliability,
      freshnessAt: input.fetchedAt,
      status: 'ACTIVE',
    }),
  );

  return { source, evidence };
};
