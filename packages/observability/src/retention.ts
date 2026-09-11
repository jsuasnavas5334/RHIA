// Observability (PH11-T001) -- "Retention" (accion 5). Funciones puras: NO
// ejecutan ningun DELETE/TTL real contra Postgres ni ningun almacen --
// calculan QUE conservar/purgar dado un `now` y una politica, y las usa
// `MetricsCollector` (in-process) tal cual. La escritura real de un job de
// purga contra `rhia.audit_event` / `rhia.system_health_event` queda para un
// ciclo futuro con acceso real a `apps/core-api` (mismo "Fuera de alcance"
// honesto que `@rhia/secrets` dejo para su wiring a `contact_point`).

export type RetentionPolicy = Readonly<{
  /** Cuantos dias conservar un registro desde que ocurrio. */
  retentionDays: number;
}>;

const nonNegativeFinite = (value: number): boolean => Number.isFinite(value) && value >= 0;

/** Instante ANTES del cual un registro se considera vencido segun la politica. */
export const computeRetentionCutoff = (policy: RetentionPolicy, now: Date = new Date()): Date | null => {
  if (!nonNegativeFinite(policy.retentionDays)) return null;
  return new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
};

export type RetainedTimestamped = Readonly<{ occurredAt: string | Date }>;

export type RetentionPartition<T> = Readonly<{ keep: readonly T[]; purge: readonly T[] }>;

/**
 * Particiona una coleccion segun la politica de retencion. Un registro con
 * fecha invalida/no parseable se mantiene en `purge` explicitamente (nunca
 * se conserva "por si acaso" un dato que no se puede fechar) para que quien
 * llame decida, en vez de arriesgar una retencion indefinida silenciosa.
 */
export const partitionByRetention = <T extends RetainedTimestamped>(
  records: readonly T[],
  policy: RetentionPolicy,
  now: Date = new Date(),
): RetentionPartition<T> => {
  const cutoff = computeRetentionCutoff(policy, now);
  if (cutoff === null) return { keep: records, purge: [] };

  const keep: T[] = [];
  const purge: T[] = [];

  for (const record of records) {
    const occurredAt = record.occurredAt instanceof Date ? record.occurredAt : new Date(record.occurredAt);
    const occurredAtMs = occurredAt.getTime();
    if (Number.isNaN(occurredAtMs) || occurredAtMs < cutoff.getTime()) {
      purge.push(record);
    } else {
      keep.push(record);
    }
  }

  return { keep, purge };
};
