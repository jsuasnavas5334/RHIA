// Observability (PH11-T001) -- "Trace IDs" (accion 2) y criterio de
// aceptacion "Trace cruza job->model->tool".
//
// Decision de diseno real (leida en el schema antes de escribir codigo, no
// asumida desde el packet): `trace_id` YA es un campo real del dominio --
// `execution.trace_id` (uuid, NOT NULL, un valor por intento de job) y
// `audit_event.trace_id` (uuid, NOT NULL) lo reusan
// (`PLAN_MAESTRO.md` seccion 9, "Ejecucion y jobs" / "Auditoria y
// observabilidad"). Este modulo NO crea un concepto nuevo de trace_id ni una
// tabla nueva: modela como ese MISMO uuid se propaga en memoria a traves de
// las 3 fronteras que hoy NO comparten una columna directa entre si --
// `execution` (job) -> `model_run` (provider/model, solo referencia
// `job_id`, no `execution_id` ni `trace_id` en el schema actual) -> `action`
// (tool call, referencia `execution_id`, que si tiene `trace_id`). El gap
// real (model_run sin trace_id persistido) se documenta explicito en
// docs/progress/PH11-T001.md -- este paquete resuelve la propagacion en
// proceso (logs/metrics/health), no una migration nueva de schema.
//
// `Span` es puro/inmutable: cada operacion devuelve un `TraceContext` nuevo,
// nunca muta el que recibio -- mismo espiritu que `SecretReference`
// (readonly) de `@rhia/secrets`.

import { createObservabilityError, type ObservabilityError } from './errors.js';

/** Las 3 fronteras reales que un trace debe poder cruzar (criterio del packet). */
export type SpanKind = 'job' | 'model' | 'tool' | 'other';

export type Span = Readonly<{
  spanId: string;
  parentSpanId: string | null;
  kind: SpanKind;
  /** Etiqueta legible (ej. nombre del job_type, provider/model, o capability_key de la tool). Nunca un valor secreto. */
  label: string;
  startedAt: string;
  endedAt: string | null;
  outcome: 'OK' | 'ERROR' | null;
}>;

export type TraceContext = Readonly<{
  /** Corresponde 1:1 a `execution.trace_id` / `audit_event.trace_id` cuando el trace nace de un job real. */
  traceId: string;
  spans: readonly Span[];
}>;

let spanCounter = 0;

/** Genera un id corto, deterministico en forma pero unico en proceso -- nunca requiere red ni crypto random. */
const nextSpanId = (): string => {
  spanCounter += 1;
  return `span-${spanCounter.toString(36)}-${Date.now().toString(36)}`;
};

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export type CreateTraceContextResult =
  | Readonly<{ ok: true; context: TraceContext }>
  | Readonly<{ ok: false; error: ObservabilityError }>;

/**
 * Crea el contexto raiz de un trace. `traceId` es obligatorio y explicito --
 * a diferencia de un `spanId` (interno, generado), el `traceId` real debe
 * venir de quien posee la fila `execution` (o generarse ANTES de crear esa
 * fila, para poder insertarla con el mismo valor) -- este paquete nunca
 * decide un `trace_id` a espaldas de quien controla la persistencia real.
 */
export const createTraceContext = (traceId: string): CreateTraceContextResult => {
  if (!nonEmptyString(traceId)) {
    return {
      ok: false,
      error: createObservabilityError(
        'RHIA_OBS_MISSING_TRACE_ID',
        'traceId requerido para crear un TraceContext -- error a evitar del packet "Logs sin correlation ID".',
      ),
    };
  }
  return { ok: true, context: { traceId, spans: [] } };
};

export type StartSpanResult =
  | Readonly<{ ok: true; context: TraceContext; spanId: string }>
  | Readonly<{ ok: false; error: ObservabilityError }>;

/**
 * Abre un span hijo. `parentSpanId: null` abre un span de nivel raiz dentro
 * del trace (tipicamente el primer span, `kind: 'job'`). Un span "job" que
 * abre un span "model" que a su vez abre un span "tool" es exactamente la
 * forma que el criterio "Trace cruza job->model->tool" verifica.
 */
export const startSpan = (
  context: TraceContext,
  input: Readonly<{ kind: SpanKind; label: string; parentSpanId?: string | null; now?: Date }>,
): StartSpanResult => {
  if (!nonEmptyString(input.label)) {
    return {
      ok: false,
      error: createObservabilityError('RHIA_OBS_INVALID_SPAN', 'label requerido para abrir un span.'),
    };
  }
  const parentSpanId = input.parentSpanId ?? null;
  if (parentSpanId !== null && !context.spans.some((span) => span.spanId === parentSpanId)) {
    return {
      ok: false,
      error: createObservabilityError(
        'RHIA_OBS_INVALID_SPAN',
        `parentSpanId "${parentSpanId}" no existe en este TraceContext.`,
      ),
    };
  }

  const spanId = nextSpanId();
  const span: Span = {
    spanId,
    parentSpanId,
    kind: input.kind,
    label: input.label,
    startedAt: (input.now ?? new Date()).toISOString(),
    endedAt: null,
    outcome: null,
  };

  return { ok: true, context: { traceId: context.traceId, spans: [...context.spans, span] }, spanId };
};

export type EndSpanResult =
  | Readonly<{ ok: true; context: TraceContext }>
  | Readonly<{ ok: false; error: ObservabilityError }>;

/** Cierra un span existente. Cerrar un span ya cerrado o inexistente es un error explicito, nunca silencioso. */
export const endSpan = (
  context: TraceContext,
  spanId: string,
  outcome: 'OK' | 'ERROR',
  now: Date = new Date(),
): EndSpanResult => {
  const index = context.spans.findIndex((span) => span.spanId === spanId);
  if (index === -1) {
    return {
      ok: false,
      error: createObservabilityError('RHIA_OBS_INVALID_SPAN', `spanId "${spanId}" no existe en este TraceContext.`),
    };
  }
  const existing = context.spans[index];
  if (!existing) {
    return {
      ok: false,
      error: createObservabilityError('RHIA_OBS_INVALID_SPAN', `spanId "${spanId}" no existe en este TraceContext.`),
    };
  }
  if (existing.endedAt !== null) {
    return {
      ok: false,
      error: createObservabilityError('RHIA_OBS_INVALID_SPAN', `spanId "${spanId}" ya fue cerrado.`),
    };
  }

  const updated: Span = { ...existing, endedAt: now.toISOString(), outcome };
  const spans = [...context.spans];
  spans[index] = updated;
  return { ok: true, context: { traceId: context.traceId, spans } };
};

/**
 * Devuelve la secuencia de `kind` en el orden en que los spans se abrieron
 * (orden de insercion, no de cierre). Utilidad directa para el criterio
 * "Trace cruza job->model->tool": `buildTracePath(ctx)` debe incluir
 * `['job', 'model', 'tool']` como subsecuencia cuando el trace realmente
 * cruzo esas 3 fronteras.
 */
export const buildTracePath = (context: TraceContext): readonly SpanKind[] => context.spans.map((span) => span.kind);

/** Verifica que una secuencia de kinds contenga `expected` como subsecuencia en orden (no necesariamente contigua). */
export const tracePathIncludesSequence = (path: readonly SpanKind[], expected: readonly SpanKind[]): boolean => {
  let cursor = 0;
  for (const kind of path) {
    if (cursor >= expected.length) break;
    if (kind === expected[cursor]) cursor += 1;
  }
  return cursor === expected.length;
};
