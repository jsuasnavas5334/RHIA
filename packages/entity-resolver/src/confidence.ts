// PH06-T004, acción 5 ("Calcular confidence"). Combina las señales ya
// evaluadas por los demás módulos (match de nombre, match de legal
// identifier, resolución de ubicación, relación de ownership) en un único
// score [0,1]. Reusa la misma técnica noisy-or de
// packages/evidence-pipeline/src/fact-collapse.ts (`combineConfidence`)
// para que evidencia corroborante suba la confianza sin nunca llegar a
// certeza absoluta — misma justificación ahí documentada.

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const combineConfidence = (confidences: readonly number[]): number => {
  if (confidences.length === 0) return 0;
  const combined = 1 - confidences.reduce((acc, confidence) => acc * (1 - confidence), 1);
  return Math.min(0.99, clamp01(combined));
};

/**
 * Penalización multiplicativa aplicada cuando hay conflictos explícitos
 * (p. ej. ubicación AMBIGUOUS, o una señal de nombre que no matchea ningún
 * candidato conocido pero tampoco hay legal identifier que la respalde).
 * Un conflicto no anula la confianza a 0 automáticamente -algo de señal
 * puede seguir siendo útil- pero SIEMPRE la reduce y SIEMPRE queda
 * registrado como conflicto explícito (ver entity-resolver.ts) para que
 * "confidence bajo no auto-confirma" (criterio de aceptación) tenga con
 * qué decidir.
 */
export const CONFLICT_PENALTY_PER_ITEM = 0.85;

export const applyConflictPenalties = (baseConfidence: number, conflictCount: number): number => {
  if (conflictCount <= 0) return baseConfidence;
  const penalty = CONFLICT_PENALTY_PER_ITEM ** conflictCount;
  return clamp01(baseConfidence * penalty);
};
