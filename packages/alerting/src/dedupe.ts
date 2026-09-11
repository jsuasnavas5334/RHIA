// Alerting & Budgets (PH11-T002) -- error a evitar del packet "Sin dedupe" y
// criterio de aceptación "No alert storm". `dedupeAlerts` es la ÚNICA puerta
// real entre "una regla produjo un Alert candidato" y "el alert realmente se
// dispara" -- todas las reglas de este paquete (`health.ts`, `queue.ts`,
// etc.) son puras y no saben nada de estado/cooldown; este módulo es el
// único que conoce el historial de alertas ya disparadas.

import type { Alert } from './contracts.js';

/** Estado real de una alerta ya disparada anteriormente (persistido por el caller -- este paquete no decide DÓNDE se guarda). */
export type ActiveAlertState = Readonly<{ id: string; lastFiredAt: string }>;

export type DedupeResult = Readonly<{
  /** Alertas que SÍ deben dispararse ahora (nuevas, o su cooldown ya venció). */
  toFire: readonly Alert[];
  /** Alertas suprimidas -- misma condición real, todavía dentro del cooldown de la última vez que se disparó. */
  suppressed: readonly Alert[];
}>;

/**
 * Un alert candidato SIEMPRE se dispara la primera vez que aparece (no hay
 * estado activo previo con ese `id`). Reaparece dentro del cooldown ->
 * suprimido (previene "alert storm" de la misma condición repitiéndose en
 * cada evaluación). El cooldown vence -> se dispara de nuevo (una condición
 * real que sigue activa después de mucho tiempo merece un recordatorio, no
 * silencio permanente).
 */
export const dedupeAlerts = (candidates: readonly Alert[], activeAlerts: readonly ActiveAlertState[], cooldownMs: number, now: Date = new Date()): DedupeResult => {
  const activeById = new Map(activeAlerts.map((active) => [active.id, active]));
  const toFire: Alert[] = [];
  const suppressed: Alert[] = [];

  for (const candidate of candidates) {
    const active = activeById.get(candidate.id);
    const withinCooldown = active !== undefined && now.getTime() - new Date(active.lastFiredAt).getTime() < cooldownMs;
    if (withinCooldown) {
      suppressed.push(candidate);
    } else {
      toFire.push(candidate);
    }
  }

  return { toFire, suppressed };
};
