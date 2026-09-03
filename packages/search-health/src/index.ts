// PH06-T001, acciones pendientes 4 y 5 ("Search Health v2"):
// (4) health score por engine a través del tiempo, y (5) el modelado de los
// eventos que alimentan ese score, listos para persistirse en la tabla
// genérica ya existente `rhia.system_health_event` (component, status,
// detail jsonb, occurred_at) — ver packages/db/migrations/0001_domain_v1.sql.
// No se creó una tabla nueva: `system_health_event` ya modela exactamente
// esto (componente + estado + detalle jsonb + timestamp), y el proyecto
// evita crecer el esquema sin necesidad demostrada.
//
// Este módulo es puro (sin I/O, sin dependencias de red ni de Postgres) para
// poder probarse de forma determinista. La escritura real de eventos
// (INSERT INTO rhia.system_health_event) y la lectura del historial para
// alimentar `computeEngineHealthScores` quedan para quien conecte esta
// lógica a un origen de datos real (n8n vía nodo PostgreSQL, o un endpoint
// de core-api) — ver docs/progress/PH06-T001.md.

/** Tipos de alerta que ya clasifica el nodo n8n `Diagnosticar salud búsqueda`
 * (`clasificarMotivoMotor`, docs/baseline/n8n/workflows/KV6AIXyIPWKSaTAp.json). */
export type SearchEngineFailureType = 'CAPTCHA' | 'RATE_LIMIT' | 'TIMEOUT' | 'SUSPENDIDO' | 'CAIDO' | 'DESCONOCIDO';

export type SearchEngineHealthStatus = 'OK' | SearchEngineFailureType;

/** Prefijo de `component` para distinguir eventos de motor de búsqueda dentro
 * de la tabla genérica `rhia.system_health_event`. */
export const SEARCH_ENGINE_COMPONENT_PREFIX = 'search_engine:' as const;

export const buildSearchEngineComponent = (engine: string): string => `${SEARCH_ENGINE_COMPONENT_PREFIX}${engine}`;

export const parseSearchEngineComponent = (component: string): string | null =>
  component.startsWith(SEARCH_ENGINE_COMPONENT_PREFIX) ? component.slice(SEARCH_ENGINE_COMPONENT_PREFIX.length) : null;

/** Forma lista para `INSERT INTO rhia.system_health_event (component, status, detail)`. */
export type SearchHealthEventInput = Readonly<{
  component: string;
  status: SearchEngineHealthStatus;
  detail: Readonly<Record<string, unknown>>;
}>;

/** Subconjunto del `diagnostico` por consulta que ya produce el nodo n8n. */
export type SearchQueryDiagnostic = Readonly<{
  query?: string | null;
  motores_detectados: readonly string[];
  motores_no_responden: readonly Readonly<{ motor: string; motivo: string; tipo: string }>[];
}>;

/**
 * Convierte el diagnóstico de una consulta (ya calculado por el nodo n8n) en
 * eventos de salud por motor. Si un motor aparece tanto en
 * `motores_detectados` (respondió con resultados) como en
 * `motores_no_responden` (alerta) dentro de la misma consulta, la alerta
 * prevalece: es la señal más accionable y evita enmascarar un 429/CAPTCHA
 * intermitente como "saludable".
 */
export const buildSearchEngineHealthEvents = (diagnostico: SearchQueryDiagnostic): SearchHealthEventInput[] => {
  const events = new Map<string, SearchHealthEventInput>();

  for (const engine of diagnostico.motores_detectados) {
    if (!engine) continue;
    events.set(engine, {
      component: buildSearchEngineComponent(engine),
      status: 'OK',
      detail: { query: diagnostico.query ?? null },
    });
  }

  for (const entry of diagnostico.motores_no_responden) {
    if (!entry.motor || entry.motor === 'NO_IDENTIFICADO') continue;
    events.set(entry.motor, {
      component: buildSearchEngineComponent(entry.motor),
      status: isSearchEngineFailureType(entry.tipo) ? entry.tipo : 'DESCONOCIDO',
      detail: { query: diagnostico.query ?? null, motivo: entry.motivo },
    });
  }

  return [...events.values()];
};

const SEARCH_ENGINE_FAILURE_TYPES: readonly SearchEngineFailureType[] = [
  'CAPTCHA',
  'RATE_LIMIT',
  'TIMEOUT',
  'SUSPENDIDO',
  'CAIDO',
  'DESCONOCIDO',
];

const isSearchEngineFailureType = (value: string): value is SearchEngineFailureType =>
  (SEARCH_ENGINE_FAILURE_TYPES as readonly string[]).includes(value);

/**
 * Clasifica el motivo textual de un motor no-respondiente en un
 * `SearchEngineFailureType`. Réplica exacta de `clasificarMotivoMotor` del
 * nodo n8n `Diagnosticar salud búsqueda`
 * (`docs/baseline/n8n/workflows/KV6AIXyIPWKSaTAp.json`) — ese nodo no puede
 * importar paquetes npm del repo (sandbox de n8n), así que mantiene su
 * propia copia inline; cualquier consumidor real de Node (PH06-T002 en
 * adelante) debe usar esta función en vez de duplicarla una tercera vez.
 * Si se corrige aquí, revisar también el nodo n8n para mantener paridad.
 */
export const classifySearchEngineFailure = (motivo: string | null | undefined): SearchEngineFailureType => {
  const texto = String(motivo ?? '').toLowerCase();

  if (texto.includes('captcha')) return 'CAPTCHA';
  if (texto.includes('too many requests') || texto.includes('429') || texto.includes('rate limit')) return 'RATE_LIMIT';
  if (texto.includes('timeout') || texto.includes('timed out')) return 'TIMEOUT';
  if (texto.includes('suspend')) return 'SUSPENDIDO';
  if (texto.includes('error') || texto.includes('down') || texto.includes('unreachable') || texto.includes('connection')) return 'CAIDO';
  return 'DESCONOCIDO';
};

/** Entrada ya normalizada de `unresponsive_engines`. */
export type NormalizedUnresponsiveEngine = Readonly<{ motor: string; motivo: string; tipo: SearchEngineFailureType }>;

/**
 * Normaliza `unresponsive_engines` tal como lo devuelve SearXNG crudo —
 * tuplas `[motor, motivo]` (forma real observada), strings sueltos, u
 * objetos `{motor, motivo}` — en la forma `{motor, motivo, tipo}` que ya
 * usa `buildSearchEngineHealthEvents`. Réplica exacta de
 * `normalizeUnresponsiveEngines` del mismo nodo n8n (ver comentario de
 * `classifySearchEngineFailure`).
 */
export const normalizeUnresponsiveEngines = (value: unknown): NormalizedUnresponsiveEngine[] => {
  if (!Array.isArray(value)) return [];

  return value.map((entry): NormalizedUnresponsiveEngine => {
    let motor = 'NO_IDENTIFICADO';
    let motivo = 'NO_IDENTIFICADO';

    if (Array.isArray(entry)) {
      motor = typeof entry[0] === 'string' && entry[0] ? entry[0] : 'NO_IDENTIFICADO';
      motivo = typeof entry[1] === 'string' && entry[1] ? entry[1] : 'NO_IDENTIFICADO';
    } else if (typeof entry === 'string') {
      motor = entry;
    } else if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      motor = typeof record['motor'] === 'string' && record['motor'] ? record['motor'] : 'NO_IDENTIFICADO';
      motivo = typeof record['motivo'] === 'string' && record['motivo'] ? record['motivo'] : 'NO_IDENTIFICADO';
    }

    return { motor, motivo, tipo: classifySearchEngineFailure(motivo) };
  });
};

// ============================================================
// Health score por engine (acción pendiente 4)
// ============================================================

/** Fila ya persistida (o a punto de leerse) desde `rhia.system_health_event`. */
export type SearchHealthEventRecord = Readonly<{
  component: string;
  status: SearchEngineHealthStatus;
  occurredAt: string | Date;
}>;

export type EngineHealthClassification = 'SALUDABLE' | 'INESTABLE' | 'DEGRADADO' | 'SIN_DATOS' | 'SIN_DATOS_SUFICIENTES';

export type EngineHealthScore = Readonly<{
  engine: string;
  /** 0..1, o null si no hay eventos del engine dentro de la ventana. */
  score: number | null;
  classification: EngineHealthClassification;
  /** Suma de pesos decaídos (éxito + fallo) usada para el score; también sirve de umbral de confianza. */
  sampleWeight: number;
  eventCount: number;
}>;

export type HealthScoreOptions = Readonly<{
  /** Instante de referencia para calcular antigüedad y decaimiento. Default: `new Date()`. */
  now?: Date;
  /** Eventos más antiguos que esta ventana se ignoran por completo. Default: 14 días. */
  windowDays?: number;
  /** Vida media del decaimiento exponencial: un evento a esta antigüedad pesa la mitad. Default: 72h (3 días). */
  halfLifeHours?: number;
  /** Peso mínimo acumulado (éxito+fallo decaídos) para animarse a clasificar; si no se alcanza -> SIN_DATOS_SUFICIENTES. Default: 3. */
  minSampleWeight?: number;
  /** Score >= este umbral -> SALUDABLE. Default: 0.85. */
  healthyThreshold?: number;
  /** Score >= este umbral (y < healthyThreshold) -> INESTABLE; por debajo -> DEGRADADO. Default: 0.5. */
  degradedThreshold?: number;
}>;

export const DEFAULT_HEALTH_SCORE_OPTIONS = {
  windowDays: 14,
  halfLifeHours: 72,
  minSampleWeight: 3,
  healthyThreshold: 0.85,
  degradedThreshold: 0.5,
} as const;

/** Alertas "duras" (bloqueo activo del motor) pesan más que las transitorias. */
const FAILURE_SEVERITY: Record<SearchEngineFailureType, number> = {
  CAPTCHA: 1.5,
  SUSPENDIDO: 1.5,
  CAIDO: 1.5,
  RATE_LIMIT: 1,
  TIMEOUT: 1,
  DESCONOCIDO: 1,
};

/**
 * Calcula, por motor, un score 0..1 (proporción de peso decaído que fue
 * éxito) sobre una ventana temporal, con decaimiento exponencial (los
 * eventos recientes pesan más que los antiguos, pero ningún evento dentro de
 * la ventana se descarta de golpe). Un motor sin eventos en la ventana
 * recibe SIN_DATOS (nunca se asume saludable por ausencia de datos); un
 * motor con muy pocos eventos recibe SIN_DATOS_SUFICIENTES en vez de una
 * clasificación prematura.
 */
export const computeEngineHealthScores = (
  events: readonly SearchHealthEventRecord[],
  options: HealthScoreOptions = {},
): EngineHealthScore[] => {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? DEFAULT_HEALTH_SCORE_OPTIONS.windowDays;
  const halfLifeHours = options.halfLifeHours ?? DEFAULT_HEALTH_SCORE_OPTIONS.halfLifeHours;
  const minSampleWeight = options.minSampleWeight ?? DEFAULT_HEALTH_SCORE_OPTIONS.minSampleWeight;
  const healthyThreshold = options.healthyThreshold ?? DEFAULT_HEALTH_SCORE_OPTIONS.healthyThreshold;
  const degradedThreshold = options.degradedThreshold ?? DEFAULT_HEALTH_SCORE_OPTIONS.degradedThreshold;

  const windowStartMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  const byEngine = new Map<string, { success: number; failure: number; count: number }>();

  for (const event of events) {
    const engine = parseSearchEngineComponent(event.component);
    if (!engine) continue;

    const occurredAt = event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt);
    const occurredAtMs = occurredAt.getTime();
    const ageMs = now.getTime() - occurredAtMs;
    if (occurredAtMs < windowStartMs || ageMs < 0) continue;

    const ageHours = ageMs / (60 * 60 * 1000);
    const decay = Math.pow(0.5, ageHours / halfLifeHours);

    const bucket = byEngine.get(engine) ?? { success: 0, failure: 0, count: 0 };
    bucket.count += 1;

    if (event.status === 'OK') {
      bucket.success += decay;
    } else {
      bucket.failure += decay * (FAILURE_SEVERITY[event.status] ?? 1);
    }

    byEngine.set(engine, bucket);
  }

  return [...byEngine.entries()]
    .map(([engine, bucket]): EngineHealthScore => {
      const sampleWeight = bucket.success + bucket.failure;

      if (sampleWeight === 0) {
        return { engine, score: null, classification: 'SIN_DATOS', sampleWeight: 0, eventCount: bucket.count };
      }

      const score = bucket.success / sampleWeight;

      if (sampleWeight < minSampleWeight) {
        return { engine, score, classification: 'SIN_DATOS_SUFICIENTES', sampleWeight, eventCount: bucket.count };
      }

      const classification: EngineHealthClassification =
        score >= healthyThreshold ? 'SALUDABLE' : score >= degradedThreshold ? 'INESTABLE' : 'DEGRADADO';

      return { engine, score, classification, sampleWeight, eventCount: bucket.count };
    })
    .sort((a, b) => a.engine.localeCompare(b.engine));
};
