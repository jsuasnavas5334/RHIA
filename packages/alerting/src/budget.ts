// Alerting & Budgets (PH11-T002), acción 4 del packet: "Cost budget" --
// criterio de aceptación nombrado explícitamente "Budget hard/soft limits".
// Reusa la FORMA real de `BudgetLimits`/`BudgetPeriodUsage` de
// `@rhia/model-router` (PH05-T003, ya DONE) -- copiada textualmente en
// `fixtures/vendored-types.ts` (ver ese archivo para el porqué exacto de la
// copia en vez de depender del paquete real en este ciclo).

import type { Alert } from './contracts.js';
import type { BudgetLimits, BudgetPeriodUsage } from './fixtures/vendored-types.js';

export type BudgetAlertThresholds = Readonly<{
  /** Fracción del límite a partir de la cual se considera "soft limit" (advertencia). Default 0.8 (80%). */
  softRatio: number;
}>;

export const DEFAULT_BUDGET_ALERT_THRESHOLDS: BudgetAlertThresholds = { softRatio: 0.8 };

const RUNBOOK = 'docs/runbooks/alerting-runbook.md#cost-budget';

type Period = 'daily' | 'monthly';

const evaluatePeriod = (period: Period, usage: BudgetPeriodUsage, limitUsd: number, thresholds: BudgetAlertThresholds, now: Date): Alert | null => {
  // Un límite <= 0 significa "sin budget configurado para este periodo" --
  // nunca se alerta sobre un límite que no existe (evita falsos positivos
  // por configuración incompleta, no por gasto real fuera de control).
  if (limitUsd <= 0) return null;

  const ratio = usage.spentUsd / limitUsd;
  if (ratio >= 1) {
    return {
      id: `COST_BUDGET:${period}:HARD`,
      category: 'COST_BUDGET',
      severity: 'CRITICAL',
      message: `Cost budget (hard limit): gasto ${period} de $${usage.spentUsd.toFixed(2)} alcanzó/superó el límite real de $${limitUsd.toFixed(2)}.`,
      cause: `BudgetPeriodUsage.${period}.spentUsd=$${usage.spentUsd.toFixed(2)} (${usage.taskCount} tareas) frente a un límite ${period} configurado de $${limitUsd.toFixed(2)} -- ratio real ${(ratio * 100).toFixed(0)}%.`,
      action: 'Límite duro alcanzado -- el router de modelos ya debe estar bloqueando tareas nuevas (SKIPPED_BUDGET). Revisar si el límite sigue siendo correcto o si hay un consumo anómalo real que investigar antes de subirlo.',
      runbookRef: RUNBOOK,
      occurredAt: now.toISOString(),
    };
  }
  if (ratio >= thresholds.softRatio) {
    return {
      id: `COST_BUDGET:${period}:SOFT`,
      category: 'COST_BUDGET',
      severity: 'WARNING',
      message: `Cost budget (soft limit): gasto ${period} de $${usage.spentUsd.toFixed(2)} alcanzó ${(ratio * 100).toFixed(0)}% del límite real de $${limitUsd.toFixed(2)}.`,
      cause: `BudgetPeriodUsage.${period}.spentUsd=$${usage.spentUsd.toFixed(2)} (${usage.taskCount} tareas) frente a un límite ${period} de $${limitUsd.toFixed(2)} -- ratio real ${(ratio * 100).toFixed(0)}%, por encima del umbral soft (${(thresholds.softRatio * 100).toFixed(0)}%).`,
      action: 'Revisar el consumo reciente por tier/proveedor antes de que se alcance el límite duro -- considerar si el patrón de consumo es legítimo o si un task class está enrutando a un tier más caro de lo necesario.',
      runbookRef: RUNBOOK,
      occurredAt: now.toISOString(),
    };
  }
  return null;
};

/**
 * "Budget hard/soft limits": evalúa el uso diario y mensual reales contra
 * `BudgetLimits` reales. Nunca produce más de 1 alert por periodo (hard
 * gana sobre soft si ambos aplicarían -- `evaluatePeriod` retorna temprano
 * en el primer caso que matchea).
 */
export const evaluateBudgetAlerts = (
  limits: BudgetLimits,
  dailyUsage: BudgetPeriodUsage,
  monthlyUsage: BudgetPeriodUsage,
  thresholds: BudgetAlertThresholds = DEFAULT_BUDGET_ALERT_THRESHOLDS,
  now: Date = new Date(),
): Alert[] => {
  const alerts: Alert[] = [];
  const daily = evaluatePeriod('daily', dailyUsage, limits.dailyLimitUsd, thresholds, now);
  if (daily) alerts.push(daily);
  const monthly = evaluatePeriod('monthly', monthlyUsage, limits.monthlyLimitUsd, thresholds, now);
  if (monthly) alerts.push(monthly);
  return alerts;
};
