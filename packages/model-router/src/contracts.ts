import type { ProviderId } from "@rhia/ai-gateway";

// Contratos neutrales del Model Router (PH05-T003). El router NUNCA
// hardcodea que perfil de modelo usar: todo (task classes, perfiles,
// budgets) se inyecta desde fuera (config/DB/tests), nunca vive como
// constante dentro de esta libreria.

export type TaskClassId = string;

export type ModelTier = "economy" | "standard" | "premium";

export interface ModelProfile {
  readonly provider: ProviderId;
  readonly model: string;
  readonly tier: ModelTier;
  /** 0..1, derivado de benchmark (PH05-T004). Este paquete no lo calcula. */
  readonly qualityScore: number;
  /** Estimacion previa a la llamada, usada para el chequeo de budget. */
  readonly estCostPerTaskUsd: number;
  readonly maxLatencyMsP95: number;
  /** "local_only" = el proveedor no envia datos fuera de la maquina (ej. Ollama). */
  readonly dataResidency: "any" | "local_only";
}

export interface TaskClassPolicy {
  readonly taskClassId: TaskClassId;
  readonly minQualityScore: number;
  readonly minConfidence: number;
  readonly requiresLocalOnly: boolean;
  /** Tiers en orden de preferencia (ej. [economy, standard, premium]). */
  readonly candidateTiers: readonly (readonly ModelProfile[])[];
}

export interface BudgetLimits {
  readonly dailyLimitUsd: number;
  readonly monthlyLimitUsd: number;
}

export interface BudgetPeriodUsage {
  readonly spentUsd: number;
  readonly taskCount: number;
}

export type RouteAttemptOutcome =
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED_BUDGET"
  | "SKIPPED_QUALITY_FLOOR"
  | "SKIPPED_RESIDENCY";

export interface RouteAttempt {
  readonly provider: ProviderId;
  readonly model: string;
  readonly tier: ModelTier;
  readonly outcome: RouteAttemptOutcome;
  readonly reason: string;
  readonly confidence: number | null;
}

export interface RouteChoice {
  readonly provider: ProviderId;
  readonly model: string;
  readonly tier: ModelTier;
}
