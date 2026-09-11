// Alerting & Budgets (PH11-T002), acción 2 del packet: "Queue stalled".
//
// No existe todavía en el repo un paquete real de cola de jobs con métricas
// propias (el runtime de agentes -- `apps/agent-runtime` -- no se revisó
// este ciclo). Esta regla define el CONTRATO real de la señal que necesita
// (edad del item más antiguo pendiente, por cola) sin inventar de dónde sale
// ese número -- el caller real (cuando exista) la alimenta desde una
// consulta real a la tabla `job`/`execution` (`packages/db/src/schema.ts`) o
// desde una métrica ya registrada en `@rhia/observability#MetricsCollector`.
// Documentado como "Fuera de alcance" (wiring real) en
// docs/progress/PH11-T002.md -- esta regla es la lógica pura, lista para
// conectarse.

import type { Alert } from './contracts.js';

export type QueueSignal = Readonly<{
  queueName: string;
  /** Edad en segundos del item pendiente más antiguo -- `null` si la cola está vacía (nunca "stalled" si no hay nada pendiente). */
  oldestPendingAgeSeconds: number | null;
  pendingCount: number;
}>;

const RUNBOOK = 'docs/runbooks/alerting-runbook.md#queue-stalled';

/**
 * Una cola vacía (`oldestPendingAgeSeconds === null`) nunca alerta -- no hay
 * nada estancado. `staleThresholdSeconds` default: 900s (15 min) -- un job
 * real de RHIA (búsqueda, outreach, scoring) no debería esperar más que eso
 * en cola bajo operación normal.
 */
export const evaluateQueueStalledAlerts = (signals: readonly QueueSignal[], staleThresholdSeconds = 900, now: Date = new Date()): Alert[] => {
  const alerts: Alert[] = [];

  for (const signal of signals) {
    if (signal.oldestPendingAgeSeconds === null) continue;
    if (signal.oldestPendingAgeSeconds < staleThresholdSeconds) continue;

    alerts.push({
      id: `QUEUE_STALLED:${signal.queueName}`,
      category: 'QUEUE_STALLED',
      severity: signal.oldestPendingAgeSeconds >= staleThresholdSeconds * 4 ? 'CRITICAL' : 'WARNING',
      message: `Queue stalled: '${signal.queueName}' tiene un item pendiente hace ${Math.round(signal.oldestPendingAgeSeconds)}s (${signal.pendingCount} pendientes en total).`,
      cause: `El item pendiente más antiguo de '${signal.queueName}' lleva ${Math.round(signal.oldestPendingAgeSeconds)}s en cola, por encima del umbral real de ${staleThresholdSeconds}s.`,
      action: 'Revisar el worker/runtime real que procesa esta cola -- confirmar que no está caído, bloqueado por rate-limit del proveedor, o esperando una aprobación humana pendiente.',
      runbookRef: RUNBOOK,
      occurredAt: now.toISOString(),
    });
  }

  return alerts;
};
