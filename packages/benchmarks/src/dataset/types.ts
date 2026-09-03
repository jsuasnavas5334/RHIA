/**
 * Contratos del dataset de benchmark (PH05-T004). Un TaskCase es una tarea
 * real del dominio RHIA con un gold label y un scorer determinista -- nunca
 * un juez basado en otro modelo (evita no-determinismo y costo extra).
 */

export type BenchmarkTaskClassId = "entity_resolution" | "classification" | "drafting" | "tool_selection";

export interface ScoreResult {
  readonly score: number; // 0..1
  readonly reason: string;
}

export interface TaskCase {
  readonly id: string;
  readonly taskClassId: BenchmarkTaskClassId;
  readonly name: string;
  /** Prompt de usuario en texto plano (sin tools ni JSON mode: mantiene el
   * caso ejecutable por cualquier candidato, incluidos los que no soportan
   * JSON estructurado, p.ej. Anthropic en este repo). */
  readonly prompt: string;
  readonly gold: string;
  /** Procedencia del gold label: quien lo definio y si tuvo revision humana real. */
  readonly goldProvenance: string;
  readonly scorer: (responseText: string) => ScoreResult;
  /** Respuesta de referencia (calidad maxima) usada para guionar al candidato
   * "premium" en el harness; NUNCA se usa como entrada de otro modelo (evita
   * juez basado en LLM), solo como texto fijo determinista para el fake
   * transport. */
  readonly referenceAnswer: string;
}

/** Scorer generico: 1.0 si el texto contiene el token gold (case-insensitive), 0 si no. */
export function containsTokenScorer(gold: string): (responseText: string) => ScoreResult {
  return (responseText: string): ScoreResult => {
    const found = responseText.toUpperCase().includes(gold.toUpperCase());
    return {
      score: found ? 1 : 0,
      reason: found
        ? `La respuesta contiene el token esperado '${gold}'.`
        : `La respuesta NO contiene el token esperado '${gold}'.`,
    };
  };
}
