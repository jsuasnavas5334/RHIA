export { validateSecretReference, isRotationDue } from './contracts.js';
export type { SecretReference, SecretReferenceValidationError, SecretReferenceValidationResult } from './contracts.js';

export { defaultSensitiveKeyNames, redactText, redactValue } from './redaction.js';

export {
  hashContactPointValue,
  contactPointValueMatchesHash,
  encryptContactPointValue,
  decryptContactPointValue,
} from './encryption.js';
export type {
  EncryptionKeyProvider,
  EncryptedContactPoint,
  ContactPointEncryptionResult,
  ContactPointDecryptionResult,
} from './encryption.js';

export { secretsErrorCodes, createSecretsError } from './errors.js';
export type { SecretsErrorCode, SecretsError } from './errors.js';
