// Alerting & Budgets (PH11-T002), acción 3 del packet: "Backup stale" --
// criterio de aceptación relacionado "Age monitor".
//
// `PH10-T004` (Backup, restore y disaster recovery) sigue `NOT_STARTED` --
// no existe todavía en el repo un mecanismo real de backup del que leer un
// timestamp real. Esta regla define el contrato real de la señal (cuándo
// terminó con éxito el último backup) sin depender de que PH10-T004 exista
// -- queda lista para conectarse en cuanto ese ciclo produzca un timestamp
// real. Documentado como "Fuera de alcance" (wiring real) en
// docs/progress/PH11-T002.md.

import type { Alert } from './contracts.js';

export type BackupStatusSignal = Readonly<{
  backupName: string;
  /** `null` si NUNCA se completó un backup exitoso -- se trata igual que "infinitamente viejo" (siempre alerta), nunca se asume sano por falta de datos. */
  lastSuccessfulBackupAt: string | null;
}>;

const RUNBOOK = 'docs/runbooks/alerting-runbook.md#backup-stale';

/**
 * "Age monitor": `maxAgeHours` default 26h -- un backup diario real (cada
 * 24h) tiene 2h de margen real antes de considerarse vencido, evitando falsos
 * positivos por variación normal del horario de corrida.
 */
export const evaluateBackupStaleAlerts = (signals: readonly BackupStatusSignal[], maxAgeHours = 26, now: Date = new Date()): Alert[] => {
  const alerts: Alert[] = [];

  for (const signal of signals) {
    if (signal.lastSuccessfulBackupAt === null) {
      alerts.push({
        id: `BACKUP_STALE:${signal.backupName}`,
        category: 'BACKUP_STALE',
        severity: 'CRITICAL',
        message: `Backup stale: '${signal.backupName}' nunca registró un backup exitoso.`,
        cause: `No existe ningún backup exitoso registrado para '${signal.backupName}' -- un desastre real hoy no tendría de dónde restaurar.`,
        action: 'Ejecutar/verificar el mecanismo de backup real de inmediato -- ver runbook para el procedimiento de backup manual de emergencia.',
        runbookRef: RUNBOOK,
        occurredAt: now.toISOString(),
      });
      continue;
    }

    const ageHours = (now.getTime() - new Date(signal.lastSuccessfulBackupAt).getTime()) / (60 * 60 * 1000);
    if (ageHours < maxAgeHours) continue;

    alerts.push({
      id: `BACKUP_STALE:${signal.backupName}`,
      category: 'BACKUP_STALE',
      severity: ageHours >= maxAgeHours * 2 ? 'CRITICAL' : 'WARNING',
      message: `Backup stale: el último backup exitoso de '${signal.backupName}' tiene ${ageHours.toFixed(1)}h (umbral real: ${maxAgeHours}h).`,
      cause: `Último backup exitoso real de '${signal.backupName}': ${signal.lastSuccessfulBackupAt} (${ageHours.toFixed(1)}h atrás), por encima del umbral de ${maxAgeHours}h.`,
      action: 'Confirmar por qué el backup automático no corrió/no completó -- ver runbook para el procedimiento de backup manual mientras se investiga.',
      runbookRef: RUNBOOK,
      occurredAt: now.toISOString(),
    });
  }

  return alerts;
};
