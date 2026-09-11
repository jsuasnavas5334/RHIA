import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBudgetAlerts } from './budget.js';
import type { BudgetLimits, BudgetPeriodUsage } from './fixtures/vendored-types.js';

const now = new Date('2026-09-10T12:00:00Z');
const limits: BudgetLimits = { dailyLimitUsd: 100, monthlyLimitUsd: 2000 };
const noUsage: BudgetPeriodUsage = { spentUsd: 0, taskCount: 0 };

test('Simulated incident -- Cost budget (hard limit): gasto diario al 100% del limite produce CRITICAL', () => {
  const dailyUsage: BudgetPeriodUsage = { spentUsd: 100, taskCount: 50 };
  const alerts = evaluateBudgetAlerts(limits, dailyUsage, noUsage, undefined, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.id, 'COST_BUDGET:daily:HARD');
  assert.equal(alerts[0]!.severity, 'CRITICAL');
});

test('Simulated incident -- Cost budget (soft limit): gasto mensual al 85% produce WARNING', () => {
  const monthlyUsage: BudgetPeriodUsage = { spentUsd: 1700, taskCount: 300 };
  const alerts = evaluateBudgetAlerts(limits, noUsage, monthlyUsage, undefined, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.id, 'COST_BUDGET:monthly:SOFT');
  assert.equal(alerts[0]!.severity, 'WARNING');
});

test('un gasto por encima de 2.4x el soft ratio (>=100% real) sigue clasificando como hard, nunca ambos a la vez', () => {
  const dailyUsage: BudgetPeriodUsage = { spentUsd: 250, taskCount: 90 };
  const alerts = evaluateBudgetAlerts(limits, dailyUsage, noUsage, undefined, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.id, 'COST_BUDGET:daily:HARD');
});

test('control positivo -- gasto por debajo del soft ratio no alerta', () => {
  const dailyUsage: BudgetPeriodUsage = { spentUsd: 50, taskCount: 10 };
  const alerts = evaluateBudgetAlerts(limits, dailyUsage, noUsage, undefined, now);
  assert.deepEqual(alerts, []);
});

test('control positivo -- un limite <= 0 (sin budget configurado) nunca alerta, sin importar el gasto', () => {
  const unconfigured: BudgetLimits = { dailyLimitUsd: 0, monthlyLimitUsd: 0 };
  const heavyUsage: BudgetPeriodUsage = { spentUsd: 9999, taskCount: 500 };
  const alerts = evaluateBudgetAlerts(unconfigured, heavyUsage, heavyUsage, undefined, now);
  assert.deepEqual(alerts, []);
});

test('gasto simultaneo diario Y mensual por encima del umbral produce 2 alerts, uno por periodo', () => {
  const dailyUsage: BudgetPeriodUsage = { spentUsd: 100, taskCount: 40 };
  const monthlyUsage: BudgetPeriodUsage = { spentUsd: 2000, taskCount: 800 };
  const alerts = evaluateBudgetAlerts(limits, dailyUsage, monthlyUsage, undefined, now);
  assert.equal(alerts.length, 2);
  assert.deepEqual(
    alerts.map((a) => a.id).sort(),
    ['COST_BUDGET:daily:HARD', 'COST_BUDGET:monthly:HARD'],
  );
});
