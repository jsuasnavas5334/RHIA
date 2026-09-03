export { EvidenceSchema, EvidenceSourceSchema, EvidenceStatusSchema, FactSchema, type Evidence, type EvidenceSource, type Fact } from './schema.js';
export { hashExcerpt } from './excerpt-hash.js';
export { classifySourceReliability, type SourceReliabilityInput } from './source-reliability.js';
export { DEFAULT_CLAIM_RULES, extractClaims, type ClaimRule, type ExtractedClaim } from './claim-extraction.js';
export {
  buildEvidenceFromSearchResult,
  type BuildEvidenceInput, type BuildEvidenceOutput, type SearchResultLike,
} from './evidence-builder.js';
export { collapseToFacts, isStaleEvidence, markStaleEvidence, type CollapseToFactsOptions } from './fact-collapse.js';
