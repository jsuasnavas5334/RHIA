// Alerting & Budgets (PH11-T002), acción 6 del packet: "Policy violation".
// Reusa `ActionKey`/`AuthorizationDecision` REALES de `@rhia/policy`
// (PH03-T002, ya DONE) -- nunca reimplementa ni infiere una decisión de
// autorización, solo agrega decisiones YA tomadas por `authorize()` real.
//
// Error a evitar del packet "Alertas por cada error individual": UNA
// decisión `DENY` aislada nunca alerta (un humano probando un permiso que no
// tiene, o un agente pidiendo algo fuera de su capability una vez, es
// operación normal del sistema de políticas -- para eso existe `authorize`).
// Lo que sí es una señal real de "Policy violation" es un PATRÓN: el mismo
// principal repitiendo el mismo `DENY` para la misma acción varias veces en
// una ventana corta -- eso sugiere un intento sostenido de saltarse la
// política (un ataque, un bug de integración reintentando ciegamente, o un
// agente mal configurado), no ruido normal.

import type { ActionKey, AuthorizationDecision } from '@rhia/policy';
import type { Alert } from './contracts.js';

export type PolicyDecisionEvent = Readonly<{
  principalId: string;
  action: ActionKey;
  decision: AuthorizationDecision;
  occurredAt: string;
}>;

export type PolicyViolationThresholds = Readonly<{
  windowMinutes: number;
  /** Número de DENY reales del mismo principal+acción dentro de la ventana para considerarlo un patrón, no ruido. Default 5. */
  denyThreshold: number;
}>;

export const DEFAULT_POLICY_VIOLATION_THRESHOLDS: PolicyViolationThresholds = { windowMinutes: 15, denyThreshold: 5 };

const RUNBOOK = 'docs/runbooks/alerting-runbook.md#policy-violation';

export const evaluatePolicyViolationAlerts = (
  events: readonly PolicyDecisionEvent[],
  thresholds: PolicyViolationThresholds = DEFAULT_POLICY_VIOLATION_THRESHOLDS,
  now: Date = new Date(),
): Alert[] => {
  const windowStartMs = now.getTime() - thresholds.windowMinutes * 60 * 1000;

  const denyEventsInWindow = events.filter((event) => {
    if (event.decision.outcome !== 'DENY') return false;
    const occurredAtMs = new Date(event.occurredAt).getTime();
    return occurredAtMs >= windowStartMs && occurredAtMs <= now.getTime();
  });

  const byPrincipalAction = new Map<string, PolicyDecisionEvent[]>();
  for (const event of denyEventsInWindow) {
    const key = `${event.principalId}::${event.action}`;
    const bucket = byPrincipalAction.get(key);
    if (bucket) bucket.push(event);
    else byPrincipalAction.set(key, [event]);
  }

  const alerts: Alert[] = [];
  for (const [key, bucketEvents] of byPrincipalAction) {
    if (bucketEvents.length < thresholds.denyThreshold) continue;
    const [principalId, action] = key.split('::') as [string, ActionKey];
    const lastCode = bucketEvents.at(-1)?.decision.code ?? 'RHIA_POLICY_DENIED';

    alerts.push({
      id: `POLICY_VIOLATION:${key}`,
      category: 'POLICY_VIOLATION',
      severity: bucketEvents.length >= thresholds.denyThreshold * 2 ? 'CRITICAL' : 'WARNING',
      message: `Policy violation: '${principalId}' recibió ${bucketEvents.length} DENY reales para '${action}' en los últimos ${thresholds.windowMinutes} minutos.`,
      cause: `${bucketEvents.length} decisiones reales DENY (último código: ${lastCode}) de '${principalId}' para la acción '${action}' dentro de una ventana de ${thresholds.windowMinutes} minutos -- por encima del umbral de ${thresholds.denyThreshold}, sugiere un intento sostenido, no un error aislado.`,
      action: 'Investigar si es un ataque/intento de bypass real, un bug de integración reintentando ciegamente sin backoff, o un agente/humano mal configurado -- no simplemente silenciar el patrón.',
      runbookRef: RUNBOOK,
      occurredAt: now.toISOString(),
    });
  }

  return alerts;
};
