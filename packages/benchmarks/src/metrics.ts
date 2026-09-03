import type { ModelProfile } from "@rhia/model-router";
import type { CandidateSpec } from "./candidates.js";
import type { BenchmarkTaskClassId } from "./dataset/index.js";
import type { BenchmarkRunResult } from "./harness.js";

export interface TaskClassBreakdown {
  readonly taskClassId: BenchmarkTaskClassId;
  readonly n: number;
  readonly qualityScore: number;
  readonly avgCostUsd: number;
  readonly avgLatencyMs: number;
}

export interface CandidateAggregate {
  readonly candidateId: string;
  readonly profile: ModelProfile;
  readonly overallQualityScore: number;
  readonly n: number;
  readonly byTaskClass: readonly TaskClassBreakdown[];
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx] as number;
}

export function aggregateCandidate(candidate: CandidateSpec, results: readonly BenchmarkRunResult[]): CandidateAggregate {
  const own = results.filter((r) => r.candidateId === candidate.id);
  const taskClasses = Array.from(new Set(own.map((r) => r.taskCase.taskClassId))).sort();

  const byTaskClass: TaskClassBreakdown[] = taskClasses.map((taskClassId) => {
    const subset = own.filter((r) => r.taskCase.taskClassId === taskClassId);
    return {
      taskClassId,
      n: subset.length,
      qualityScore: Math.round(average(subset.map((r) => r.score)) * 1000) / 1000,
      avgCostUsd: average(subset.map((r) => r.costUsd)),
      avgLatencyMs: average(subset.map((r) => r.latencyMs)),
    };
  });

  const overallQualityScore = Math.round(average(own.map((r) => r.score)) * 1000) / 1000;
  const latenciesSorted = [...own.map((r) => r.latencyMs)].sort((a, b) => a - b);
  const p95LatencyMs = Math.max(1, Math.round(percentile(latenciesSorted, 95)));
  const avgCostUsd = Math.round(average(own.map((r) => r.costUsd)) * 1_000_000) / 1_000_000;

  const profile: ModelProfile = {
    provider: candidate.provider,
    model: candidate.model,
    tier: candidate.tier,
    qualityScore: overallQualityScore,
    estCostPerTaskUsd: avgCostUsd,
    maxLatencyMsP95: p95LatencyMs,
    dataResidency: candidate.dataResidency,
  };

  return { candidateId: candidate.id, profile, overallQualityScore, n: own.length, byTaskClass };
}

export function aggregateAll(
  candidates: readonly CandidateSpec[],
  results: readonly BenchmarkRunResult[],
): readonly CandidateAggregate[] {
  return candidates.map((candidate) => aggregateCandidate(candidate, results));
}
