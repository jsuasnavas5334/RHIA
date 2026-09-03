export type { BenchmarkTaskClassId, ScoreResult, TaskCase } from "./types.js";
export { containsTokenScorer } from "./types.js";
export { entityResolutionCases } from "./entity-resolution.js";
export { classificationCases } from "./classification.js";
export { draftingCases } from "./drafting.js";
export { toolSelectionCases, RHIA_TOOL_CATALOG } from "./tool-selection.js";

import type { TaskCase } from "./types.js";
import { entityResolutionCases } from "./entity-resolution.js";
import { classificationCases } from "./classification.js";
import { draftingCases } from "./drafting.js";
import { toolSelectionCases } from "./tool-selection.js";

/** Dataset versionado v1 del benchmark RHIA (PH05-T004). */
export const BENCHMARK_DATASET_VERSION = "v1";

export const ALL_CASES: readonly TaskCase[] = [
  ...entityResolutionCases,
  ...classificationCases,
  ...draftingCases,
  ...toolSelectionCases,
];
