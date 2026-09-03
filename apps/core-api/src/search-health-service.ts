import { authorize, type Principal } from '@rhia/policy';
import { computeEngineHealthScores, DEFAULT_HEALTH_SCORE_OPTIONS, type EngineHealthScore } from '@rhia/search-health';
import { CoreServiceError } from './company-service.js';
import type { CoreDependencies } from './ports.js';

const requireAuthorization = (principal: Principal): void => {
  const decision = authorize(principal, 'READ_OPERATIONS');
  if (decision.outcome !== 'ALLOW') {
    throw new CoreServiceError(decision.code ?? 'RHIA_POLICY_DENIED', 403, decision.reason);
  }
};

export type SearchEngineHealthReport = Readonly<{
  scores: readonly EngineHealthScore[];
  windowDays: number;
  halfLifeHours: number;
  generatedAt: string;
}>;

/**
 * PH06-T001, acción pendiente 4 (cierre): alimenta `computeEngineHealthScores`
 * (`@rhia/search-health`, módulo puro sin I/O) con el historial real leído de
 * `rhia.system_health_event` vía `CoreDependencies.searchHealth`. Expuesto
 * como servicio de solo lectura para el endpoint `GET /api/v1/search-health`.
 */
export class SearchHealthService {
  constructor(private readonly dependencies: CoreDependencies) {}

  async getEngineScores(principal: Principal): Promise<SearchEngineHealthReport> {
    requireAuthorization(principal);
    const now = this.dependencies.now();
    const windowDays = DEFAULT_HEALTH_SCORE_OPTIONS.windowDays;
    const halfLifeHours = DEFAULT_HEALTH_SCORE_OPTIONS.halfLifeHours;
    const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const events = await this.dependencies.searchHealth.listRecentSearchEngineEvents(since);
    const scores = computeEngineHealthScores(events, { now, windowDays, halfLifeHours });
    return { scores, windowDays, halfLifeHours, generatedAt: now.toISOString() };
  }
}
