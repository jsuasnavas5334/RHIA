import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBackupStaleAlerts, type BackupStatusSignal } from './backup.js';

const now = new Date('2026-09-10T12:00:00Z');

test('Simulated incident -- Backup stale: ningun backup exitoso registrado produce CRITICAL', () => {
  const signals: BackupStatusSignal[] = [{ backupName: 'postgres-daily', lastSuccessfulBackupAt: null }];
  const alerts = evaluateBackupStaleAlerts(signals, 26, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.severity, 'CRITICAL');
  assert.equal(alerts[0]!.runbookRef, 'docs/runbooks/alerting-runbook.md#backup-stale');
});

test('Simulated incident -- un backup de 30h (por encima del umbral de 26h) produce WARNING', () => {
  const signals: BackupStatusSignal[] = [{ backupName: 'postgres-daily', lastSuccessfulBackupAt: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString() }];
  const alerts = evaluateBackupStaleAlerts(signals, 26, now);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.severity, 'WARNING');
});

test('un backup de mas de 2x el umbral escala a CRITICAL', () => {
  const signals: BackupStatusSignal[] = [{ backupName: 'postgres-daily', lastSuccessfulBackupAt: new Date(now.getTime() - 60 * 60 * 60 * 1000).toISOString() }];
  const alerts = evaluateBackupStaleAlerts(signals, 26, now);
  assert.equal(alerts[0]!.severity, 'CRITICAL');
});

test('control positivo -- un backup reciente (dentro del umbral) no alerta', () => {
  const signals: BackupStatusSignal[] = [{ backupName: 'postgres-daily', lastSuccessfulBackupAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() }];
  const alerts = evaluateBackupStaleAlerts(signals, 26, now);
  assert.deepEqual(alerts, []);
});
