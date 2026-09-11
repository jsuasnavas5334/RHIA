// PH06-T005, acción 3 ("Reuse evidence") y acción 5 ("Record cache hit").
//
// Flujo esperado: antes de disparar una nueva búsqueda para
// (organizationId, subjectType, subjectId, claimType), el llamador junta la
// evidencia ya conocida para esa combinación (cualquier status — esta
// función decide cuál sigue siendo utilizable, no asume que ya viene
// filtrada) y llama a `evaluateResearchCache`. `CACHE_HIT` significa "no
// repitas la búsqueda, ya hay evidencia fresca que reutilizar";
// `CACHE_MISS`/`STALE_REVALIDATE` significan "dispara la búsqueda" (la
// segunda conserva cuál evidencia vieja sigue como referencia mientras se
// revalida). El resultado (`CacheEvaluationResult`) ya es la forma
// auditable — el llamador solo necesita loguearlo/persistirlo tal cual.

import type { Evidence, EvidenceSource } from '@rhia/evidence-pipeline';
import { UuidSchema } from '@rhia/contracts';
import { buildCacheKey } from './cache-key.js';
import { findLatestInvalidation } from './invalidation.js';
import { resolveTtlDays } from './ttl-policy.js';
import {
  CacheEvaluationResultSchema,
  type CacheEvaluationResult,
  type CachePolicy,
  type ManualInvalidation,
} from './schema.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type EvaluateResearchCacheInput = Readonly<{
  organizationId: string;
  subjectType: string;
  subjectId: string;
  claimType: string;
  /** Evidencia candidata para este (subject, claimType). Puede incluir cualquier status y otras keys — se filtra internamente. */
  evidence: readonly Evidence[];
  /** Fuentes referenciadas por `evidence[].sourceId`, para resolver el override de TTL por `sourceType`. Fuente ausente del map = sin override de fuente para esa evidencia. */
  sources: ReadonlyMap<string, EvidenceSource>;
  policy: CachePolicy;
  invalidations?: readonly ManualInvalidation[];
  now?: () => Date;
}>;

export const evaluateResearchCache = (input: EvaluateResearchCacheInput): CacheEvaluationResult => {
  const organizationId = UuidSchema.parse(input.organizationId);
  const subjectId = UuidSchema.parse(input.subjectId);
  const now = input.now?.() ?? new Date();
  const nowIso = now.toISOString();

  const key = buildCacheKey({
    organizationId,
    subjectType: input.subjectType,
    subjectId,
    claimType: input.claimType,
  });

  const relevant = input.evidence.filter(
    (item) =>
      item.organizationId === organizationId &&
      item.subjectType === input.subjectType &&
      item.subjectId === subjectId &&
      item.claimType === input.claimType,
  );

  if (relevant.length === 0) {
    return CacheEvaluationResultSchema.parse({
      key,
      decision: 'CACHE_MISS',
      reason: 'NO_EVIDENCE',
      evaluatedAt: nowIso,
      reusableEvidenceIds: [],
      staleEvidenceIds: [],
    });
  }

  const latestInvalidation = findLatestInvalidation(key, input.invalidations ?? []);

  const reusable: Evidence[] = [];
  const stale: Evidence[] = [];
  let ttlDaysApplied: number | undefined;
  let anyInvalidatedByManualEntry = false;

  for (const item of relevant) {
    if (item.status !== 'ACTIVE') {
      stale.push(item);
      continue;
    }

    const sourceType = input.sources.get(item.sourceId)?.sourceType;
    // `exactOptionalPropertyTypes`: no pasar la key `sourceType` con valor
    // `undefined` explícito -- se omite del todo cuando no hay fuente
    // resuelta, en vez de asignarle `undefined`.
    const ttlDays = resolveTtlDays(
      sourceType === undefined ? { claimType: item.claimType } : { claimType: item.claimType, sourceType },
      input.policy,
    );
    ttlDaysApplied = ttlDaysApplied === undefined ? ttlDays : Math.min(ttlDaysApplied, ttlDays);

    const ageMs = now.getTime() - new Date(item.freshnessAt).getTime();
    const withinTtl = ageMs <= ttlDays * MS_PER_DAY;
    const invalidatedAfterCollection =
      latestInvalidation !== undefined && latestInvalidation.invalidatedAt > item.freshnessAt;

    if (invalidatedAfterCollection) anyInvalidatedByManualEntry = true;

    if (withinTtl && !invalidatedAfterCollection) reusable.push(item);
    else stale.push(item);
  }

  if (reusable.length > 0) {
    const mostRecentFreshnessAt = reusable.reduce(
      (latest, item) => (item.freshnessAt > latest ? item.freshnessAt : latest),
      reusable[0]!.freshnessAt,
    );

    return CacheEvaluationResultSchema.parse({
      key,
      decision: 'CACHE_HIT',
      reason: 'FRESH_EVIDENCE_FOUND',
      evaluatedAt: nowIso,
      ttlDaysApplied,
      reusableEvidenceIds: reusable.map((item) => item.id),
      staleEvidenceIds: stale.map((item) => item.id),
      mostRecentFreshnessAt,
    });
  }

  const reason = anyInvalidatedByManualEntry ? 'MANUALLY_INVALIDATED' : 'TTL_EXPIRED';

  return CacheEvaluationResultSchema.parse({
    key,
    decision: 'STALE_REVALIDATE',
    reason,
    evaluatedAt: nowIso,
    ttlDaysApplied,
    reusableEvidenceIds: [],
    staleEvidenceIds: stale.map((item) => item.id),
  });
};
