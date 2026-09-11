// Skill Library (PH09-T004) -- errores normalizados. Mismo patron
// estructural que el resto de PH09.

export const skillErrorCodes = [
  'RHIA_SKILL_INVALID_MANIFEST',
  'RHIA_SKILL_STALE',
  'RHIA_SKILL_PRECONDITION_FAILED',
  'RHIA_SKILL_VALIDATION_FAILED',
  'RHIA_SKILL_PROCEDURE_FAILED',
  'RHIA_SKILL_UNEXPECTED_FAILURE',
] as const;
export type SkillErrorCode = (typeof skillErrorCodes)[number];

export interface SkillError {
  readonly code: SkillErrorCode;
  readonly message: string;
  readonly safeDetails: string;
}

export function createSkillError(code: SkillErrorCode, message: string, safeDetails?: string): SkillError {
  return { code, message, safeDetails: safeDetails ?? message };
}
