import type { GatewayMessage } from "@rhia/ai-gateway";
import type { ModelProfile, TaskClassPolicy } from "../contracts.js";

export function makeProfile(overrides: Partial<ModelProfile> & Pick<ModelProfile, "provider" | "model" | "tier">): ModelProfile {
  return {
    qualityScore: overrides.qualityScore ?? 0.8,
    estCostPerTaskUsd: overrides.estCostPerTaskUsd ?? 0.01,
    maxLatencyMsP95: overrides.maxLatencyMsP95 ?? 3000,
    dataResidency: overrides.dataResidency ?? "any",
    ...overrides,
  };
}

export function makePolicy(overrides: Partial<TaskClassPolicy> & Pick<TaskClassPolicy, "taskClassId" | "candidateTiers">): TaskClassPolicy {
  return {
    minQualityScore: overrides.minQualityScore ?? 0,
    minConfidence: overrides.minConfidence ?? 0.8,
    requiresLocalOnly: overrides.requiresLocalOnly ?? false,
    ...overrides,
  };
}

export function testMessages(text: string): readonly GatewayMessage[] {
  return [{ role: "user", content: [{ type: "text", text }] }];
}
