export { alertCategories } from './contracts.js';
export type { Alert, AlertCategory, AlertSeverity } from './contracts.js';

export { dedupeAlerts } from './dedupe.js';
export type { ActiveAlertState, DedupeResult } from './dedupe.js';

export { evaluateComponentHealthAlerts } from './health.js';

export { evaluateQueueStalledAlerts } from './queue.js';
export type { QueueSignal } from './queue.js';

export { evaluateBackupStaleAlerts } from './backup.js';
export type { BackupStatusSignal } from './backup.js';

export { evaluateBudgetAlerts, DEFAULT_BUDGET_ALERT_THRESHOLDS } from './budget.js';
export type { BudgetAlertThresholds } from './budget.js';

export { evaluateBounceSpikeAlert, DEFAULT_BOUNCE_SPIKE_THRESHOLDS } from './bounce.js';
export type { BounceSample, BounceSpikeThresholds } from './bounce.js';

export { evaluatePolicyViolationAlerts, DEFAULT_POLICY_VIOLATION_THRESHOLDS } from './policy-violation.js';
export type { PolicyDecisionEvent, PolicyViolationThresholds } from './policy-violation.js';

export type { BudgetLimits, BudgetPeriodUsage, BounceLedgerStatus } from './fixtures/vendored-types.js';
export { bounceLedgerStatuses } from './fixtures/vendored-types.js';
