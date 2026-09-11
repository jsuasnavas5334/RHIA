// Alerting & Budgets (PH11-T002) -- "Contexto necesario" del packet: "Alert
// thresholds". Un `Alert` es SIEMPRE el resultado de evaluar una señal real
// contra un umbral real -- este paquete nunca alerta "por si acaso", y nunca
// alerta por cada evento individual (error a evitar del packet "Alertas por
// cada error individual") -- cada regla en `*.ts` decide, con su propia
// lógica documentada, cuándo una señal cruza de "normal" a "requiere
// atención humana".

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export const alertCategories = [
  'SEARCH_DEGRADED',
  'COMPONENT_DEGRADED',
  'QUEUE_STALLED',
  'BACKUP_STALE',
  'COST_BUDGET',
  'BOUNCE_SPIKE',
  'POLICY_VIOLATION',
] as const;
export type AlertCategory = (typeof alertCategories)[number];

/**
 * Criterio de aceptación "Alert incluye causa y acción": `cause` y `action`
 * son campos OBLIGATORIOS y siempre específicos a la señal real evaluada --
 * nunca un texto genérico como "algo salió mal". Validación final del
 * packet "Runbook enlazado desde alerta": `runbookRef` apunta siempre a una
 * sección real de `docs/runbooks/alerting-runbook.md` (nunca una URL vacía o
 * inventada).
 *
 * `id` es la clave de DEDUPE (no un id único por ocurrencia) -- dos
 * evaluaciones sucesivas de la MISMA condición real (p. ej. el mismo
 * componente siguiendo `DOWN`) producen el mismo `id`, para que
 * `dedupeAlerts` (ver `dedupe.ts`) pueda suprimir repeticiones dentro de un
 * cooldown real -- error a evitar del packet "Sin dedupe".
 */
export type Alert = Readonly<{
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  message: string;
  cause: string;
  action: string;
  runbookRef: string;
  occurredAt: string;
}>;
