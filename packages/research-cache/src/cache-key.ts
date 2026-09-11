// PH06-T005, acción 1 ("Definir cache keys"). Error a evitar explícito del
// Task Packet: "Cache por nombre sin país/entidad" — por eso la key NUNCA
// se construye a partir de texto libre (nombre de empresa tal cual
// escrito). Se construye únicamente a partir de identidad ya resuelta:
// `organizationId` (tenant) + `subjectId` (UUID de la entidad ya resuelta
// por @rhia/entity-resolver, que ya distingue país/grupo/entidad) +
// `subjectType` + `claimType`. Misma fórmula que `groupKey` en
// packages/evidence-pipeline/src/fact-collapse.ts, para que "misma key de
// cache" y "mismo grupo de evidencia que colapsa a un fact" sean
// exactamente la misma partición.

export type CacheKeyInput = Readonly<{
  organizationId: string;
  subjectType: string;
  subjectId: string;
  claimType: string;
}>;

export const buildCacheKey = (input: CacheKeyInput): string =>
  `${input.organizationId}::${input.subjectType}::${input.subjectId}::${input.claimType}`;
