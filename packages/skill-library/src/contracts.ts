// Skill Library (PH09-T004) -- empaqueta un procedimiento YA REAL (un
// `Scenario` de `@rhia/playwright-worker` o una `ComputerUseTask` de
// `@rhia/computer-use`, ambos DONE de este mismo ciclo) como un `Skill`
// versionado, reutilizable, con precondiciones y validacion final
// obligatorias. "Contexto necesario" del packet: "Tool contracts" -- se
// reusa `ToolManifest` de `@rhia/tool-registry` para el "fingerprint" real
// del contrato de la tool contra la que el skill fue construido (accion
// "Versioning" + Prueba requerida "Skill stale").
//
// Nunca se reimplementa el procedimiento en si -- un `Skill` es una
// ENVOLTURA sobre un `Scenario`/`ComputerUseTask` ya validado por su propio
// paquete (`validateScenario`/`validateTask`, reusados aqui, nunca
// duplicados).

import { createHash } from 'node:crypto';
import { looksLikeRawSecret } from '@rhia/tool-registry';
import type { ToolManifest } from '@rhia/tool-registry';
import { validateScenario } from '@rhia/playwright-worker';
import type { Scenario } from '@rhia/playwright-worker';
import { validateTask } from '@rhia/computer-use';
import type { ComputerUseTask } from '@rhia/computer-use';

export type SkillProcedure =
  | Readonly<{ kind: 'PLAYWRIGHT'; scenario: Scenario }>
  | Readonly<{ kind: 'COMPUTER_USE'; task: ComputerUseTask }>;

export type SkillFieldSpec = Readonly<{ name: string; type: 'string' | 'number' | 'boolean'; required: boolean }>;

/** Accion "Inputs/outputs": esquema minimo real, sin depender de una libreria de validacion externa (nunca instalada en este ciclo, ver Fuera de alcance). */
export type SkillIoSchema = Readonly<{ inputs: readonly SkillFieldSpec[]; outputs: readonly SkillFieldSpec[] }>;

export type SkillPrecondition = Readonly<{ id: string; description: string }>;
export type SkillValidation = Readonly<{ id: string; description: string }>;

export type SkillManifest = Readonly<{
  id: string;
  name: string;
  /** Accion "Versioning". Formato real validado: `MAJOR.MINOR.PATCH`. */
  version: string;
  targetToolId: string;
  /** Fingerprint REAL del `ToolManifest` contra el que este skill fue construido -- ver `computeToolContractFingerprint`. Prueba requerida "Skill stale". */
  builtAgainstToolFingerprint: string;
  io: SkillIoSchema;
  preconditions: readonly SkillPrecondition[];
  /** Criterio "Validation final obligatoria": NO puede estar vacio -- `validateSkillManifest` rechaza un manifest sin ninguna. */
  validations: readonly SkillValidation[];
  procedure: SkillProcedure;
  /** Accion "Rollback/fallback": procedimiento alterno, opcional, ejecutado SOLO si `procedure` falla. */
  rollback?: SkillProcedure;
}>;

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/**
 * Fingerprint estable del contrato REAL de una tool -- solo las partes que
 * importan para que los pasos de un skill sigan siendo validos
 * (`allowedActions`/`allowedDomains`/`requiredCapability`), nunca campos
 * administrativos (`ownerRef`/`riskLevel`/`credentialRef`) que pueden
 * cambiar sin invalidar los pasos de ningun skill.
 */
export const computeToolContractFingerprint = (manifest: ToolManifest): string => {
  const stable = {
    requiredCapability: manifest.requiredCapability,
    allowedActions: [...manifest.allowedActions].sort(),
    allowedDomains: [...manifest.allowedDomains].sort(),
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
};

/** Prueba requerida "Skill stale": el contrato real de la tool cambio desde que el skill se construyo. */
export const isSkillStale = (skill: SkillManifest, currentToolManifest: ToolManifest): boolean =>
  skill.targetToolId !== currentToolManifest.id || skill.builtAgainstToolFingerprint !== computeToolContractFingerprint(currentToolManifest);

const validateFieldSpec = (prefix: string, raw: unknown, errors: SkillValidationError[]): void => {
  if (typeof raw !== 'object' || raw === null) {
    errors.push({ field: prefix, reason: 'cada campo debe ser un objeto { name, type, required }.' });
    return;
  }
  const field = raw as Record<string, unknown>;
  if (!nonEmptyString(field['name'])) errors.push({ field: `${prefix}.name`, reason: 'name requerido, string no vacio.' });
  if (field['type'] !== 'string' && field['type'] !== 'number' && field['type'] !== 'boolean') {
    errors.push({ field: `${prefix}.type`, reason: 'type debe ser string, number o boolean.' });
  }
  if (typeof field['required'] !== 'boolean') errors.push({ field: `${prefix}.required`, reason: 'required debe ser boolean.' });
};

export type SkillValidationError = Readonly<{ field: string; reason: string }>;
export type SkillValidationResult =
  | Readonly<{ valid: true; skill: SkillManifest }>
  | Readonly<{ valid: false; errors: readonly SkillValidationError[] }>;

const validateProcedure = (field: string, raw: unknown, errors: SkillValidationError[]): void => {
  if (typeof raw !== 'object' || raw === null) {
    errors.push({ field, reason: 'procedure requerido.' });
    return;
  }
  const procedure = raw as Record<string, unknown>;
  if (procedure['kind'] === 'PLAYWRIGHT') {
    const result = validateScenario(procedure['scenario']);
    if (!result.valid) result.errors.forEach((error) => errors.push({ field: `${field}.scenario.${error.field}`, reason: error.reason }));
  } else if (procedure['kind'] === 'COMPUTER_USE') {
    const result = validateTask(procedure['task']);
    if (!result.valid) result.errors.forEach((error) => errors.push({ field: `${field}.task.${error.field}`, reason: error.reason }));
  } else {
    errors.push({ field: `${field}.kind`, reason: 'kind debe ser PLAYWRIGHT o COMPUTER_USE.' });
  }
};

/**
 * Validacion REAL en runtime de un `SkillManifest` recibido como `unknown`
 * -- mismo principio que `validateToolManifest`/`validateScenario`/
 * `validateTask`. Delegar la validacion del `procedure`/`rollback` a
 * `validateScenario`/`validateTask` (nunca reimplementada) es lo que
 * garantiza el criterio "No mezcla secretos" -- un `TYPE.LITERAL` que
 * parece un secreto real ya se rechaza ahi, sin duplicar el heuristico.
 */
export const validateSkillManifest = (raw: unknown): SkillValidationResult => {
  const errors: SkillValidationError[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: [{ field: 'root', reason: 'El skill debe ser un objeto.' }] };
  }
  const input = raw as Record<string, unknown>;

  if (!nonEmptyString(input['id'])) errors.push({ field: 'id', reason: 'id requerido, string no vacio.' });
  if (!nonEmptyString(input['name'])) errors.push({ field: 'name', reason: 'name requerido, string no vacio.' });
  if (typeof input['version'] !== 'string' || !SEMVER_PATTERN.test(input['version'])) {
    errors.push({ field: 'version', reason: 'version debe seguir el formato MAJOR.MINOR.PATCH -- accion "Versioning".' });
  }
  if (!nonEmptyString(input['targetToolId'])) errors.push({ field: 'targetToolId', reason: 'targetToolId requerido, string no vacio.' });
  if (!nonEmptyString(input['builtAgainstToolFingerprint'])) errors.push({ field: 'builtAgainstToolFingerprint', reason: 'builtAgainstToolFingerprint requerido -- ver computeToolContractFingerprint.' });

  const io = input['io'];
  if (typeof io !== 'object' || io === null) {
    errors.push({ field: 'io', reason: 'io requerido { inputs, outputs }.' });
  } else {
    const ioInput = io as Record<string, unknown>;
    const inputs = ioInput['inputs'];
    const outputs = ioInput['outputs'];
    if (!Array.isArray(inputs)) errors.push({ field: 'io.inputs', reason: 'io.inputs debe ser un array (puede estar vacio).' });
    else inputs.forEach((field, index) => validateFieldSpec(`io.inputs[${index}]`, field, errors));
    if (!Array.isArray(outputs)) errors.push({ field: 'io.outputs', reason: 'io.outputs debe ser un array (puede estar vacio).' });
    else outputs.forEach((field, index) => validateFieldSpec(`io.outputs[${index}]`, field, errors));
  }

  const preconditions = input['preconditions'];
  if (!Array.isArray(preconditions)) {
    errors.push({ field: 'preconditions', reason: 'preconditions debe ser un array (puede estar vacio).' });
  } else {
    preconditions.forEach((raw, index) => {
      const precondition = raw as Record<string, unknown>;
      if (typeof raw !== 'object' || raw === null || !nonEmptyString(precondition['id']) || !nonEmptyString(precondition['description'])) {
        errors.push({ field: `preconditions[${index}]`, reason: 'cada precondition requiere { id, description } no vacios.' });
      }
    });
  }

  const validations = input['validations'];
  if (!Array.isArray(validations) || validations.length === 0) {
    errors.push({ field: 'validations', reason: 'validations debe tener al menos un elemento -- criterio "Validation final obligatoria".' });
  } else {
    validations.forEach((raw, index) => {
      const validation = raw as Record<string, unknown>;
      if (typeof raw !== 'object' || raw === null || !nonEmptyString(validation['id']) || !nonEmptyString(validation['description'])) {
        errors.push({ field: `validations[${index}]`, reason: 'cada validation requiere { id, description } no vacios.' });
      }
    });
  }

  validateProcedure('procedure', input['procedure'], errors);
  if (input['rollback'] !== undefined) validateProcedure('rollback', input['rollback'], errors);

  // Regla fija del proyecto (defensa adicional, mas alla de lo ya validado
  // dentro de scenario/task): ningun nombre de campo de io "parece" un
  // secreto real pegado por accidente como nombre de input.
  const ioObj = io as Record<string, unknown> | null;
  if (ioObj && Array.isArray(ioObj['inputs'])) {
    (ioObj['inputs'] as unknown[]).forEach((raw, index) => {
      const field = raw as Record<string, unknown> | null;
      const name = field?.['name'];
      if (typeof name === 'string' && looksLikeRawSecret(name)) {
        errors.push({ field: `io.inputs[${index}].name`, reason: 'el nombre del input parece una credencial real -- criterio "No mezcla secretos".' });
      }
    });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    skill: {
      id: input['id'] as string,
      name: input['name'] as string,
      version: input['version'] as string,
      targetToolId: input['targetToolId'] as string,
      builtAgainstToolFingerprint: input['builtAgainstToolFingerprint'] as string,
      io: io as SkillIoSchema,
      preconditions: preconditions as readonly SkillPrecondition[],
      validations: validations as readonly SkillValidation[],
      procedure: input['procedure'] as SkillProcedure,
      ...(input['rollback'] !== undefined ? { rollback: input['rollback'] as SkillProcedure } : {}),
    },
  };
};
