import type {
  AiGateway,
  GatewayMessage,
  GatewayResponseFormat,
  GatewayResult,
  GatewayToolDefinition,
} from "@rhia/ai-gateway";
import type {
  BudgetLimits,
  ModelProfile,
  RouteAttempt,
  RouteChoice,
  TaskClassId,
  TaskClassPolicy,
} from "./contracts.js";
import type { BudgetLedger } from "./budget.js";

export interface RouteRequest {
  readonly requestId: string;
  readonly taskClassId: TaskClassId;
  readonly messages: readonly GatewayMessage[];
  readonly tools: readonly GatewayToolDefinition[];
  readonly responseFormat: GatewayResponseFormat;
  readonly maxOutputTokens: number;
  readonly temperature: number;
}

export interface RouteOptions {
  readonly timeoutMs: number;
}

export interface RouteDecision {
  readonly requestId: string;
  readonly taskClassId: TaskClassId;
  readonly chosen: RouteChoice | null;
  readonly attempts: readonly RouteAttempt[];
  readonly result: GatewayResult | null;
  /** Explicacion legible: "por que se eligio [este] modelo" (validacion final del packet). */
  readonly explanation: string;
}

export type ConfidenceEvaluator = (result: Extract<GatewayResult, { status: "SUCCEEDED" }>) => number;

export const defaultConfidenceEvaluator: ConfidenceEvaluator = (result) => {
  switch (result.finishReason) {
    case "stop":
      return 1;
    case "tool_call":
      return 0.9;
    case "length":
      return 0.4;
    case "content_filter":
      return 0.2;
  }
};

interface BestSoFar {
  readonly choice: RouteChoice;
  readonly result: Extract<GatewayResult, { status: "SUCCEEDED" }>;
  readonly confidence: number;
}

/**
 * Elige perfil de modelo por task class usando calidad, budget, latencia
 * declarada y privacidad (dataResidency), y escala a un tier superior si la
 * confianza de la respuesta queda por debajo del umbral de la policy.
 *
 * El Router NUNCA decide "que proveedor" de forma fija: toda policy/perfil
 * llega por parametro. Este archivo no importa ningun adapter concreto de
 * @rhia/ai-gateway ni referencia nombres de proveedor en su logica.
 */
export class ModelRouter {
  private readonly gateway: AiGateway;
  private readonly ledger: BudgetLedger;
  private readonly limits: BudgetLimits;
  private readonly confidenceEvaluator: ConfidenceEvaluator;

  constructor(
    gateway: AiGateway,
    ledger: BudgetLedger,
    limits: BudgetLimits,
    confidenceEvaluator: ConfidenceEvaluator = defaultConfidenceEvaluator,
  ) {
    this.gateway = gateway;
    this.ledger = ledger;
    this.limits = limits;
    this.confidenceEvaluator = confidenceEvaluator;
  }

  async route(request: RouteRequest, policy: TaskClassPolicy, options: RouteOptions): Promise<RouteDecision> {
    const attempts: RouteAttempt[] = [];
    let bestSoFar: BestSoFar | null = null;

    for (const tier of policy.candidateTiers) {
      let tierSucceeded = false;

      for (const profile of tier) {
        if (policy.requiresLocalOnly && profile.dataResidency !== "local_only") {
          attempts.push({
            provider: profile.provider,
            model: profile.model,
            tier: profile.tier,
            outcome: "SKIPPED_RESIDENCY",
            reason: "La task class exige datos locales (dataResidency=local_only) y este perfil no lo garantiza.",
            confidence: null,
          });
          continue;
        }

        if (profile.qualityScore < policy.minQualityScore) {
          attempts.push({
            provider: profile.provider,
            model: profile.model,
            tier: profile.tier,
            outcome: "SKIPPED_QUALITY_FLOOR",
            reason: `qualityScore ${profile.qualityScore} por debajo del piso ${policy.minQualityScore} de la task class.`,
            confidence: null,
          });
          continue;
        }

        const daily = this.ledger.getDailyUsage();
        const monthly = this.ledger.getMonthlyUsage();
        if (daily.spentUsd + profile.estCostPerTaskUsd > this.limits.dailyLimitUsd) {
          attempts.push({
            provider: profile.provider,
            model: profile.model,
            tier: profile.tier,
            outcome: "SKIPPED_BUDGET",
            reason: `Excedería el budget diario (usado $${daily.spentUsd.toFixed(4)} + est. $${profile.estCostPerTaskUsd.toFixed(4)} > límite $${this.limits.dailyLimitUsd}).`,
            confidence: null,
          });
          continue;
        }
        if (monthly.spentUsd + profile.estCostPerTaskUsd > this.limits.monthlyLimitUsd) {
          attempts.push({
            provider: profile.provider,
            model: profile.model,
            tier: profile.tier,
            outcome: "SKIPPED_BUDGET",
            reason: `Excedería el budget mensual (usado $${monthly.spentUsd.toFixed(4)} + est. $${profile.estCostPerTaskUsd.toFixed(4)} > límite $${this.limits.monthlyLimitUsd}).`,
            confidence: null,
          });
          continue;
        }

        const result = await this.gateway.invoke(
          {
            requestId: request.requestId,
            provider: profile.provider,
            model: profile.model,
            messages: request.messages,
            tools: request.tools,
            responseFormat: request.responseFormat,
            maxOutputTokens: request.maxOutputTokens,
            temperature: request.temperature,
          },
          { timeoutMs: options.timeoutMs },
        );

        if (result.status === "FAILED") {
          attempts.push({
            provider: profile.provider,
            model: profile.model,
            tier: profile.tier,
            outcome: "FAILED",
            reason: `${result.error.code}: ${result.error.message}`,
            confidence: null,
          });
          continue;
        }

        const costForLedger = result.cost.amount > 0 || result.cost.isEstimate === false ? result.cost.amount : profile.estCostPerTaskUsd;
        this.ledger.record(costForLedger);
        const confidence = this.confidenceEvaluator(result);
        attempts.push({
          provider: profile.provider,
          model: profile.model,
          tier: profile.tier,
          outcome: "SUCCEEDED",
          reason: `Respondió (finishReason=${result.finishReason}, confidence=${confidence.toFixed(2)}).`,
          confidence,
        });

        const choice: RouteChoice = { provider: profile.provider, model: profile.model, tier: profile.tier };
        if (bestSoFar === null || confidence > bestSoFar.confidence) {
          bestSoFar = { choice, result, confidence };
        }

        if (confidence >= policy.minConfidence) {
          return {
            requestId: request.requestId,
            taskClassId: request.taskClassId,
            chosen: choice,
            attempts,
            result,
            explanation: `Se eligió ${profile.provider}/${profile.model} (tier ${profile.tier}) porque respondió con confidence ${confidence.toFixed(2)} >= umbral ${policy.minConfidence} de la task class '${request.taskClassId}', dentro de budget y del piso de calidad.`,
          };
        }

        // Confianza insuficiente: no seguir gastando presupuesto en este
        // mismo tier, escalar directo al siguiente.
        tierSucceeded = true;
        break;
      }

      if (tierSucceeded) {
        continue; // ya se obtuvo respuesta de este tier (aunque de baja confianza); prueba el siguiente tier
      }
    }

    if (bestSoFar !== null) {
      return {
        requestId: request.requestId,
        taskClassId: request.taskClassId,
        chosen: bestSoFar.choice,
        attempts,
        result: bestSoFar.result,
        explanation: `Ningún candidato alcanzó el umbral de confianza ${policy.minConfidence}; se devuelve la mejor respuesta disponible: ${bestSoFar.choice.provider}/${bestSoFar.choice.model} (tier ${bestSoFar.choice.tier}, confidence ${bestSoFar.confidence.toFixed(2)}).`,
      };
    }

    return {
      requestId: request.requestId,
      taskClassId: request.taskClassId,
      chosen: null,
      attempts,
      result: null,
      explanation: `Ningún candidato de la task class '${request.taskClassId}' fue viable (budget, piso de calidad, residencia de datos o fallo de proveedor). Ver 'attempts' para el detalle por candidato.`,
    };
  }
}
