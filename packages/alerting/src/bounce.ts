// Alerting & Budgets (PH11-T002), acción 5 del packet: "Bounce spike".
// Reusa el enum REAL de estados de `TouchLedgerEntry.status`
// (`@rhia/outreach-policy`, PH08-T002 ya DONE) -- copiado textualmente en
// `fixtures/vendored-types.ts` (ver ese archivo para el porqué).

import type { Alert } from './contracts.js';
import type { BounceLedgerStatus } from './fixtures/vendored-types.js';

export type BounceSample = Readonly<{ status: BounceLedgerStatus }>;

export type BounceSpikeThresholds = Readonly<{
  /** Muestra mínima real antes de calcular una tasa -- evita alertar sobre "2 de 3 rebotaron" (ruido estadístico, no un spike real). Default 20. */
  minSampleSize: number;
  /** Tasa de rebote a partir de la cual se considera un spike real. Default 0.05 (5%). */
  bounceRateThreshold: number;
}>;

export const DEFAULT_BOUNCE_SPIKE_THRESHOLDS: BounceSpikeThresholds = { minSampleSize: 20, bounceRateThreshold: 0.05 };

const RUNBOOK = 'docs/runbooks/alerting-runbook.md#bounce-spike';

/**
 * Solo cuenta como "muestra relevante" un touch que ya salió (`SENT`/
 * `DELIVERED`/`BOUNCED`) -- `PLANNED`/`SENDING`/`FAILED`/`CANCELLED`/
 * `OPTED_OUT`/`REPLIED` no participan del cálculo de tasa de rebote (no son
 * ni un envío exitoso ni un rebote real).
 */
const isRelevant = (status: BounceLedgerStatus): boolean => status === 'SENT' || status === 'DELIVERED' || status === 'BOUNCED';

export const evaluateBounceSpikeAlert = (samples: readonly BounceSample[], thresholds: BounceSpikeThresholds = DEFAULT_BOUNCE_SPIKE_THRESHOLDS, now: Date = new Date()): Alert[] => {
  const relevant = samples.filter((sample) => isRelevant(sample.status));
  if (relevant.length < thresholds.minSampleSize) return [];

  const bounced = relevant.filter((sample) => sample.status === 'BOUNCED').length;
  const rate = bounced / relevant.length;
  if (rate < thresholds.bounceRateThreshold) return [];

  return [
    {
      id: 'BOUNCE_SPIKE:outreach',
      category: 'BOUNCE_SPIKE',
      severity: rate >= thresholds.bounceRateThreshold * 3 ? 'CRITICAL' : 'WARNING',
      message: `Bounce spike: ${bounced}/${relevant.length} touches reales rebotaron (${(rate * 100).toFixed(1)}%, umbral ${(thresholds.bounceRateThreshold * 100).toFixed(1)}%).`,
      cause: `De ${relevant.length} touches reales enviados/entregados/rebotados en la ventana evaluada, ${bounced} terminaron en BOUNCED -- tasa real ${(rate * 100).toFixed(1)}%.`,
      action: 'Pausar la secuencia/canal afectado y revisar la calidad real de la lista de contactos y la reputación del dominio/número de envío antes de seguir enviando.',
      runbookRef: RUNBOOK,
      occurredAt: now.toISOString(),
    },
  ];
};
