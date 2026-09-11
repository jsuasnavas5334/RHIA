// Observability (PH11-T001) -- "Structured logs" (accion 1). Error a evitar
// del packet: "Logs sin correlation ID" -- por eso `traceId` es un campo
// OBLIGATORIO de `StructuredLogEntry`, nunca opcional, y `createLogEntry`
// rechaza explicitamente construir una entrada sin el. Error a evitar del
// packet: "Datos sensibles" -- por eso TODO log pasa por `redactValue`
// (reusado tal cual de `@rhia/secrets`, PH10-T001) antes de considerarse
// "creado"; este paquete nunca reimplementa la redaccion.

import { redactText, redactValue } from '@rhia/secrets';
import { createObservabilityError, type ObservabilityError } from './errors.js';

export const logLevels = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof logLevels)[number];

export type StructuredLogEntry = Readonly<{
  level: LogLevel;
  /** Nombre del componente que emite el log (ej. "agent-runtime.worker", "ai-gateway.openai", "tool-registry.playwright"). */
  component: string;
  /** Mensaje ya redactado -- ver `redactText`. */
  message: string;
  /** `execution.trace_id` / `audit_event.trace_id` real cuando el log ocurre dentro de un job; siempre obligatorio (correlation ID). */
  traceId: string;
  spanId: string | null;
  /** Metadata estructurada, ya redactada recursivamente -- ver `redactValue`. */
  fields: Readonly<Record<string, unknown>>;
  occurredAt: string;
}>;

export type CreateLogEntryInput = Readonly<{
  level: LogLevel;
  component: string;
  message: string;
  traceId: string;
  spanId?: string | null;
  fields?: Readonly<Record<string, unknown>>;
  now?: Date;
}>;

export type CreateLogEntryResult =
  | Readonly<{ ok: true; entry: StructuredLogEntry }>
  | Readonly<{ ok: false; error: ObservabilityError }>;

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/**
 * Construye una entrada de log estructurada, validada y redactada. Nunca
 * lanza -- una entrada invalida (sin `traceId`, sin `component`) devuelve un
 * `ObservabilityError` explicito en vez de un log parcial o silenciosamente
 * descartado.
 */
export const createLogEntry = (input: CreateLogEntryInput): CreateLogEntryResult => {
  if (!nonEmptyString(input.traceId)) {
    return {
      ok: false,
      error: createObservabilityError(
        'RHIA_OBS_MISSING_TRACE_ID',
        'traceId requerido para crear un log estructurado -- error a evitar del packet "Logs sin correlation ID".',
      ),
    };
  }
  if (!nonEmptyString(input.component)) {
    return {
      ok: false,
      error: createObservabilityError('RHIA_OBS_INVALID_SPAN', 'component requerido para crear un log estructurado.'),
    };
  }

  const fields = (redactValue(input.fields ?? {}) as Record<string, unknown>) ?? {};

  return {
    ok: true,
    entry: {
      level: input.level,
      component: input.component,
      message: redactText(input.message),
      traceId: input.traceId,
      spanId: input.spanId ?? null,
      fields,
      occurredAt: (input.now ?? new Date()).toISOString(),
    },
  };
};

export type Logger = Readonly<{
  component: string;
  log: (level: LogLevel, message: string, options?: Readonly<{ traceId: string; spanId?: string | null; fields?: Readonly<Record<string, unknown>> }>) => CreateLogEntryResult;
}>;

/**
 * Fabrica un logger atado a un `component` fijo -- cada llamada real sigue
 * requiriendo `traceId` explicito (nunca un default global compartido entre
 * traces distintos, eso ocultaria el error "Logs sin correlation ID" en vez
 * de evitarlo). Este logger NUNCA escribe a stdout/archivo/red por si solo
 * -- produce `StructuredLogEntry` puros; el sink real (consola, archivo,
 * `audit_event`) lo conecta un ciclo futuro con acceso real a `apps/core-api`.
 */
export const createLogger = (component: string): Logger => ({
  component,
  log: (level, message, options) => {
    const input: CreateLogEntryInput = {
      level,
      component,
      message,
      traceId: options?.traceId ?? '',
      ...(options?.spanId !== undefined ? { spanId: options.spanId } : {}),
      ...(options?.fields !== undefined ? { fields: options.fields } : {}),
    };
    return createLogEntry(input);
  },
});
