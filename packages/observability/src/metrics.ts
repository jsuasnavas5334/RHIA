// Observability (PH11-T001) -- "Metrics collector" (accion 4). Paquete puro
// (sin I/O, sin red, sin Postgres) -- mismo espiritu que `@rhia/search-health`:
// modela y agrega en memoria; la exportacion real hacia un backend de
// metricas (n8n, un endpoint de core-api, etc.) queda para un ciclo futuro
// con acceso real. Error a evitar del packet "Datos sensibles": los `tags`
// de cada muestra pasan por `redactValue` (reusado de `@rhia/secrets`) antes
// de aceptarse -- un tag como `{ userEmail: "..." }` nunca sobrevive intacto.

import { redactValue } from '@rhia/secrets';
import { createObservabilityError, type ObservabilityError } from './errors.js';
import { partitionByRetention, type RetentionPolicy } from './retention.js';

export type MetricKind = 'counter' | 'gauge' | 'histogram';

export type MetricSample = Readonly<{
  name: string;
  kind: MetricKind;
  value: number;
  tags: Readonly<Record<string, unknown>>;
  occurredAt: string;
}>;

export type MetricSummary = Readonly<{
  name: string;
  kind: MetricKind;
  count: number;
  sum: number;
  min: number;
  max: number;
  /** Percentil aproximado por interpolacion sobre las muestras retenidas -- suficiente para un "Metrics collector v1", no un backend real de histogramas. */
  p50: number;
  p95: number;
}>;

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const percentile = (sortedValues: readonly number[], p: number): number => {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return sortedValues[index] ?? 0;
};

export type RecordMetricResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: ObservabilityError }>;

/**
 * Colector de metricas en memoria con retencion aplicada. `record` nunca
 * lanza -- una muestra invalida (nombre vacio, valor no finito) se rechaza
 * con `ObservabilityError` y no se agrega a la coleccion.
 */
export class MetricsCollector {
  private samples: MetricSample[] = [];

  constructor(private readonly retentionPolicy: RetentionPolicy = { retentionDays: 30 }) {}

  record(
    name: string,
    kind: MetricKind,
    value: number,
    tags: Readonly<Record<string, unknown>> = {},
    now: Date = new Date(),
  ): RecordMetricResult {
    if (!nonEmptyString(name)) {
      return { ok: false, error: createObservabilityError('RHIA_OBS_INVALID_METRIC', 'name requerido para registrar una metrica.') };
    }
    if (!Number.isFinite(value)) {
      return { ok: false, error: createObservabilityError('RHIA_OBS_INVALID_METRIC', `value debe ser finito para la metrica "${name}".`) };
    }

    const redactedTags = (redactValue(tags) as Record<string, unknown>) ?? {};
    this.samples.push({ name, kind, value, tags: redactedTags, occurredAt: now.toISOString() });
    this.applyRetention(now);
    return { ok: true };
  }

  /** Purga muestras vencidas segun la politica de retencion -- se aplica automaticamente en cada `record`, tambien invocable manualmente. */
  applyRetention(now: Date = new Date()): number {
    const { keep, purge } = partitionByRetention(this.samples, this.retentionPolicy, now);
    this.samples = [...keep];
    return purge.length;
  }

  /** Todas las muestras retenidas de una metrica (util para pruebas y debugging), en el orden en que se registraron. */
  samplesFor(name: string): readonly MetricSample[] {
    return this.samples.filter((sample) => sample.name === name);
  }

  /** Agrega las muestras retenidas de una metrica en un resumen listo para un endpoint/dashboard. `null` si no hay muestras. */
  summarize(name: string): MetricSummary | null {
    const values = this.samplesFor(name).map((sample) => sample.value);
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const first = this.samplesFor(name)[0];
    if (!first) return null;

    return {
      name,
      kind: first.kind,
      count: values.length,
      sum: values.reduce((total, value) => total + value, 0),
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
    };
  }

  /** Nombres unicos de metricas actualmente retenidas. */
  metricNames(): readonly string[] {
    return [...new Set(this.samples.map((sample) => sample.name))].sort();
  }
}
