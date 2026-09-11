export {
  ScoreComponentIdSchema, ScoringWeightsSchema, ScoreBreakdownEntrySchema, OpportunityScoreResultSchema,
  type ScoreComponentId, type ScoringWeights, type ScoreBreakdownEntry, type OpportunityScoreResult,
} from './schema.js';
export {
  DEFAULT_COUNTRY_PRIORITY_TABLE, DEFAULT_COUNTRY_PRIORITY, countryPriority, geoPriority,
  type CountryPriorityTable, type CityPriorityTable,
} from './geo-priority.js';
export {
  fitScore, signalScore, contactabilityScore, timingScore, evidenceScore,
  DEFAULT_TIMING_WINDOW_DAYS, DEFAULT_EVIDENCE_SATURATION_COUNT, type OpportunitySignalInput,
} from './components.js';
export {
  computeOpportunityScore, DEFAULT_SCORE_VERSION, DEFAULT_SCORING_WEIGHTS,
  type ComputeOpportunityScoreInput, type ComputeOpportunityScoreOptions,
} from './scoring.js';
