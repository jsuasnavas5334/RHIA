export {
  NameSignalSchema, LegalIdentifierSignalSchema, LocationSignalSchema, OwnershipSignalSchema,
  KnownEntitySchema, EntityResolutionInputSchema, LocationResolutionStatusSchema, LocationResolutionSchema,
  RelationshipResolutionSchema, EntityResolutionStatusSchema, EntityResolutionResultSchema,
  type NameSignal, type LegalIdentifierSignal, type LocationSignal, type OwnershipSignal,
  type KnownEntity, type EntityResolutionInput, type LocationResolution, type RelationshipResolution,
  type EntityResolutionResult,
} from './schema.js';
export { normalizeCompanyName, nameSimilarity } from './name-normalization.js';
export { normalizeLegalIdentifier, legalIdentifiersMatch } from './legal-identifier.js';
export { resolveLocation } from './location-resolver.js';
export { detectRelationship } from './relationship-resolver.js';
export { combineConfidence, applyConflictPenalties, CONFLICT_PENALTY_PER_ITEM } from './confidence.js';
export { matchByLegalIdentifier, matchByNameAndLocation, type LegalIdentifierMatch, type NameLocationMatch } from './entity-matcher.js';
export { resolveCompanyEntity, ESCALATION_CONFIDENCE_THRESHOLD } from './entity-resolver.js';
