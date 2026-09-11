// Alerting & Budgets (PH11-T002), acción 1 del packet: "Search degraded"
// (más una generalización honesta al resto de `ComponentKind` reales de
// `@rhia/observability`, mismo espíritu que ese propio paquete generalizó
// `@rhia/search-health`). Reusa `HealthSnapshot`/`ComponentHealthScore`/
// `parseComponentId` REALES de `@rhia/observability` (PH11-T001, ya DONE) --
// nunca reimplementa la clasificación de salud.

import { parseComponentId, type ComponentHealthScore, type HealthSnapshot } from '@rhia/observability';
import type { Alert } from './contracts.js';

const RUNBOOK = 'docs/runbooks/alerting-runbook.md';

const causeFor = (score: ComponentHealthScore): string =>
  `computeComponentHealthScores clasificó '${score.component}' como ${score.classification} ` +
  `(score=${score.score === null ? 'null' : score.score.toFixed(2)}, último status real='${score.lastStatus ?? 'desconocido'}', ` +
  `${score.eventCount} eventos reales en la ventana de evaluación).`;

const actionFor = (score: ComponentHealthScore): string =>
  score.classification === 'DOWN'
    ? 'Investigar el componente de inmediato -- ver runbook. Si aplica, activar el fallback/circuit breaker real del componente.'
    : 'Monitorear de cerca en el dashboard de health -- revisar los eventos recientes del componente antes de que la clasificación escale a DOWN.';

/**
 * Evalúa un `HealthSnapshot` real y produce un `Alert` por cada componente
 * cuya clasificación es `DEGRADED` o `DOWN` -- nunca por `NO_DATA`/`UNSTABLE`
 * (esos son estados esperables/transitorios, no accionables por sí solos;
 * error a evitar del packet "Alertas por cada error individual" generalizado
 * a "no alertar por cada clasificación no perfecta"). Un componente
 * `search_engine` produce la categoría `SEARCH_DEGRADED` (acción 1 del
 * packet, nombrada explícitamente); cualquier otro `ComponentKind` real
 * (`model_provider`/`tool`/`db`/`app`/`n8n`/`job_runtime`) produce
 * `COMPONENT_DEGRADED` -- mismo mecanismo real, generalizado.
 */
export const evaluateComponentHealthAlerts = (snapshot: HealthSnapshot, now: Date = new Date()): Alert[] => {
  const alerts: Alert[] = [];

  for (const score of snapshot.components) {
    if (score.classification !== 'DEGRADED' && score.classification !== 'DOWN') continue;

    const parsed = parseComponentId(score.component);
    const isSearchEngine = parsed?.kind === 'search_engine';
    const category = isSearchEngine ? 'SEARCH_DEGRADED' : 'COMPONENT_DEGRADED';
    const label = isSearchEngine ? 'Search degraded' : `Component degraded (${parsed?.kind ?? 'desconocido'})`;

    alerts.push({
      id: `${category}:${score.component}`,
      category,
      severity: score.classification === 'DOWN' ? 'CRITICAL' : 'WARNING',
      message: `${label}: '${score.component}' está ${score.classification}.`,
      cause: causeFor(score),
      action: actionFor(score),
      runbookRef: `${RUNBOOK}#${isSearchEngine ? 'search-degraded' : 'component-degraded'}`,
      occurredAt: now.toISOString(),
    });
  }

  return alerts;
};
