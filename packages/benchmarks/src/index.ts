export type { BenchmarkTaskClassId, ScoreResult, TaskCase } from "./dataset/index.js";
export {
  ALL_CASES,
  BENCHMARK_DATASET_VERSION,
  entityResolutionCases,
  classificationCases,
  draftingCases,
  toolSelectionCases,
  RHIA_TOOL_CATALOG,
  containsTokenScorer,
} from "./dataset/index.js";

export type { CandidateSpec } from "./candidates.js";
export { CANDIDATES } from "./candidates.js";

export type { ScriptedAnswer } from "./scripted-transport.js";
export { buildFakeTransportFor, buildResponseBody } from "./scripted-transport.js";

export type { BenchmarkRunResult } from "./harness.js";
export { runBenchmark, runOne } from "./harness.js";

export type { CandidateAggregate, TaskClassBreakdown } from "./metrics.js";
export { aggregateAll, aggregateCandidate } from "./metrics.js";

export { toMarkdownReport, toModelProfilesJson } from "./report.js";
