export {
  RoleAreaSchema, UseCaseContextSchema, RoleArchetypeSchema, CandidateSearchHitSchema, TitleStatusSchema,
  ContactCandidateSchema, ContactDiscoveryResultSchema,
  type RoleArea, type UseCaseContext, type RoleArchetype, type CandidateSearchHit, type TitleStatus,
  type ContactCandidate, type ContactDiscoveryResult,
} from './schema.js';
export { deriveTargetRoles, matchRoleAreaForTitle, foldText } from './role-derivation.js';
export { CONTACT_CLAIM_RULES, contactFullNameRule, contactJobTitleRule } from './claim-rules.js';
export {
  resolvePersonIdentity, DEFAULT_TITLE_STALE_AFTER_DAYS,
  type ResolvePersonIdentityInput, type ResolvedPersonIdentity,
} from './person-identity.js';
export { assertCompanyLinkage, MissingCompanyLinkageError, type ResolvedCompanyLink } from './company-linking.js';
export { buildContactQuery, buildContactSearchQueries, type CompanySearchContext, type ContactSearchQuery } from './candidate-search.js';
export { discoverContacts, type DiscoveredHit, type DiscoverContactsInput, type DiscoverContactsOutput } from './contact-discovery.js';
