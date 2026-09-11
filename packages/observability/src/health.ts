// Observability (PH11-T001) -- "Health endpoints" (accion 3) y criterio de
// aceptacion "Health por componente". Prueba requerida del packet
// "Provider outage" se cubre en `health.test.ts`.
//
// Decision de reuso (guardrail del proyecto: no crecer el esquema de
// Postgres sin revisar si ya existe algo reutilizable, revisado en
// `packages/db/src/schema.ts` antes de escribir este archivo): la tabla
// generica `rhia.system_health_event` (`component`, `status`, `detail`
// jsonb, `occurred_at`) YA EXISTE -- la usa `@rhia/search-health`
// (PH06-T001) para motores de busqueda con un prefijo fijo
// `search_engine:`. Este modulo NO crea una tabla nueva ni un prefijo mas:
// generaliza el MISMO concepto a cualquier componente del sistema (job
// runtime, model provider, tool, db, app, n8n) usando un prefijo por
// `ComponentKind` en vez de uno solo fijo para busqueda. La logica de score
// de `@rhia/search-health#computeEngineHealthScores` es especifica de
// motores de busqueda (parsea solo el prefijo `search_engine:`) -- se
// reimplementa aqui de forma generica en vez de importarla, porque intentar
// reusarla forzaria a este paquete a depender de `@rhia/search-health` solo
// para un parser de prefijo que no aplica a los demas componentes reales
// del proyecto (model providers, tools, workers). Ambos modulos escriben a
// la MISMA tabla real, nunca duplican el schema.

export type ComponentKind = 'job_runtime' | 'model_provider' | 'tool' | 'db' | 'app' | 'n8n' | 'search_engine';

export type ComponentHealthStatus = 'OK' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export const buildComponentId = (kind: ComponentKind, name: string): string => `${kind}:${name}`;

export const parseComponentId = (component: string): Readonly<{ kind: string; name: string }> | null => {
  const separatorIndex = component.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === component.length - 1) return null;
  return { kind: component.slice(0, separatorIndex), name: component.slice(separatorIndex + 1) };
};

/** Forma lista para `INSERT INTO rhia.system_health_event (component, status, detail)` -- misma tabla real, nunca duplicada. */
export type HealthEventInput = Readonly<{
  component: string;
  status: ComponentHealthStatus;
  detail: Readonly<Record<string, unknown>>;
}>;

export const buildHealthEvent = (
  kind: ComponentKind,
  name: string,
  status: ComponentHealthStatus,
  detail: Readonly<Record<string, unknown>> = {},
): HealthEventInput => ({ component: buildComponentId(kind, name), status, detail });

/** Fila ya persistida (o a punto de leerse) desde `rhia.system_health_event`. */
export type HealthEventRecord = Readonly<{
  component: string;
  status: ComponentHealthStatus;
  occurredAt: string | Date;
}>;

export type HealthClassification = 'HEALTHY' | 'UNSTABLE' | 'DEGRADED' | 'DOWN' | 'NO_DATA';

export type ComponentHealthScore = Readonly<{
  component: string;
  /** 0..1, o null si no hay eventos del componente dentro de la ventana. */
  score: number | null;
  classification: HealthClassification;
  sampleWeight: number;
  eventCount: number;
  lastStatus: ComponentHealthStatus | null;
}>;

export type HealthScoreOptions = Readonly<{
  now?: Date;
  /** Eventos mas antiguos que esta ventana se ignoran. Default: 14 dias -- mismo default que `@rhia/search-health`. */
  windowDays?: number;
  /** Vida media del decaimiento exponencial. Default: 72h -- mismo default que `@rhia/search-health`. */
  halfLifeHours?: number;
  /** Peso minimo acumulado para clasificar; si no se alcanza -> NO_DATA con muestra insuficiente. Default: 3. */
  minSampleWeight?: number;
  healthyThreshold?: number;
  degradedThreshold?: number;
}>;

export const DEFAULT_HEALTH_SCORE_OPTIONS = {
  windowDays: 14,
  halfLifeHours: 72,
  minSampleWeight: 3,
  healthyThreshold: 0.85,
  degradedThreshold: 0.5,
} as const;

/** `DOWN` pesa mas que `DEGRADED` -- una caida dura del componente debe dominar el score mas que degradacion parcial. */
const STATUS_FAILURE_SEVERITY: Record<ComponentHealthStatus, number> = {
  OK: 0,
  DEGRADED: 1,
  DOWN: 1.5,
  UNKNOWN: 1,
};

/**
 * Calcula, por componente, un score 0..1 con decaimiento exponencial --
 * mismo algoritmo/espiritu que `@rhia/search-health#computeEngineHealthScores`
 * pero generico sobre cualquier `component` (no solo motores de busqueda).
 * Un componente sin eventos en la ventana recibe `NO_DATA` (nunca se asume
 * saludable por ausencia de datos).
 */
export const computeComponentHealthScores = (
  events: readonly HealthEventRecord[],
  options: HealthScoreOptions = {},
): ComponentHealthScore[] => {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? DEFAULT_HEALTH_SCORE_OPTIONS.windowDays;
  const halfLifeHours = options.halfLifeHours ?? DEFAULT_HEALTH_SCORE_OPTIONS.halfLifeHours;
  const minSampleWeight = options.minSampleWeight ?? DEFAULT_HEALTH_SCORE_OPTIONS.minSampleWeight;
  const healthyThreshold = options.healthyThreshold ?? DEFAULT_HEALTH_SCORE_OPTIONS.healthyThreshold;
  const degradedThreshold = options.degradedThreshold ?? DEFAULT_HEALTH_SCORE_OPTIONS.degradedThreshold;

  const windowStartMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  type Bucket = {
    success: number;
    failure: number;
    count: number;
    lastStatus: ComponentHealthStatus | null;
    lastAt: number;
  };

  const byComponent = new Map<string, Bucket>();

  // Registra el componente aunque TODOS sus eventos queden fuera de la
  // ventana -- un componente conocido sin datos recientes debe reportarse
  // como `NO_DATA` explicito (criterio "Health por componente": un
  // componente real no debe desaparecer en silencio del snapshot solo
  // porque no tuvo actividad reciente).
  const getBucket = (component: string): Bucket => {
    let bucket = byComponent.get(component);
    if (!bucket) {
      bucket = { success: 0, failure: 0, count: 0, lastStatus: null, lastAt: -Infinity };
      byComponent.set(component, bucket);
    }
    return bucket;
  };

  for (const event of events) {
    const bucket = getBucket(event.component);

    const occurredAt = event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt);
    const occurredAtMs = occurredAt.getTime();
    const ageMs = now.getTime() - occurredAtMs;
    if (occurredAtMs < windowStartMs || ageMs < 0) continue;

    const ageHours = ageMs / (60 * 60 * 1000);
    const decay = Math.pow(0.5, ageHours / halfLifeHours);

    bucket.count += 1;

    if (event.status === 'OK') {
      bucket.success += decay;
    } else {
      bucket.failure += decay * STATUS_FAILURE_SEVERITY[event.status];
    }

    if (occurredAtMs >= bucket.lastAt) {
      bucket.lastAt = occurredAtMs;
      bucket.lastStatus = event.status;
    }
  }

  return [...byComponent.entries()]
    .map(([component, bucket]): ComponentHealthScore => {
      const sampleWeight = bucket.success + bucket.failure;

      if (sampleWeight === 0) {
        return {
          component,
          score: null,
          classification: 'NO_DATA',
          sampleWeight: 0,
          eventCount: bucket.count,
          lastStatus: bucket.lastStatus,
        };
      }

      const score = bucket.success / sampleWeight;

      if (sampleWeight < minSampleWeight) {
        return {
          component,
          score,
          classification: 'NO_DATA',
          sampleWeight,
          eventCount: bucket.count,
          lastStatus: bucket.lastStatus,
        };
      }

      const classification: HealthClassification =
        score >= healthyThreshold ? 'HEALTHY' : score >= degradedThreshold ? 'UNSTABLE' : bucket.lastStatus === 'DOWN' ? 'DOWN' : 'DEGRADED';

      return { component, score, classification, sampleWeight, eventCount: bucket.count, lastStatus: bucket.lastStatus };
    })
    .sort((a, b) => a.component.localeCompare(b.component));
};

/** Snapshot listo para un endpoint de health "por componente" -- criterio del packet "Health por componente". */
export type HealthSnapshot = Readonly<{
  generatedAt: string;
  components: readonly ComponentHealthScore[];
  /** Overall = peor clasificacion real entre todos los componentes con datos (nunca se promedia para ocultar un DOWN aislado). */
  overall: HealthClassification;
}>;

const CLASSIFICATION_SEVERITY: Record<HealthClassification, number> = {
  HEALTHY: 0,
  NO_DATA: 1,
  UNSTABLE: 2,
  DEGRADED: 3,
  DOWN: 4,
};

export const buildHealthSnapshot = (scores: readonly ComponentHealthScore[], now: Date = new Date()): HealthSnapshot => {
  const withData = scores.filter((score) => score.classification !== 'NO_DATA');
  const overall: HealthClassification =
    withData.length === 0
      ? 'NO_DATA'
      : withData.reduce((worst, score) => (CLASSIFICATION_SEVERITY[score.classification] > CLASSIFICATION_SEVERITY[worst] ? score.classification : worst), 'HEALTHY' as HealthClassification);

  return { generatedAt: now.toISOString(), components: scores, overall };
};
