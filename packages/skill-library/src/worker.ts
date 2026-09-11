// Skill Library (PH09-T004) -- ejecuta un `SkillManifest` (contracts.ts):
// valida, comprueba que no este obsoleto, comprueba precondiciones reales,
// delega el procedimiento REAL al worker correspondiente (ya construido y
// probado en este mismo ciclo -- `@rhia/playwright-worker`/
// `@rhia/computer-use`, nunca reimplementado aqui), intenta un rollback si
// el procedimiento falla, y SIEMPRE corre las validaciones declaradas antes
// de considerar la corrida un exito real.

import type { Scenario, WorkerRunResult as PlaywrightRunResult } from '@rhia/playwright-worker';
import type { ComputerUseTask, ComputerUseRunResult } from '@rhia/computer-use';
import type { ToolManifest } from '@rhia/tool-registry';
import type { SkillManifest, SkillProcedure, SkillValidationError } from './contracts.js';
import { isSkillStale, validateSkillManifest } from './contracts.js';
import type { PreconditionChecker, ValidationChecker } from './checkers.js';
import { createSkillError, type SkillError } from './errors.js';

/**
 * Interfaces ESTRUCTURALES minimas (solo el metodo `run` real que este
 * paquete necesita) en vez de las clases concretas `PlaywrightWorker`/
 * `ComputerUseWorker` -- una instancia real de esas clases SI satisface
 * esta interfaz (tiene ese metodo publico), pero un fake de prueba tambien
 * puede satisfacerla sin depender de los internals/fakes privados de esos
 * paquetes (que sus `package.json#exports` no exponen fuera de ellos).
 */
export interface PlaywrightProcedureRunner {
  run(scenario: Scenario): Promise<PlaywrightRunResult>;
}
export interface ComputerUseProcedureRunner {
  run(task: ComputerUseTask): Promise<ComputerUseRunResult>;
}

export type ProcedureRunResult = Readonly<{ kind: 'PLAYWRIGHT'; result: PlaywrightRunResult }> | Readonly<{ kind: 'COMPUTER_USE'; result: ComputerUseRunResult }>;

const procedureSucceeded = (run: ProcedureRunResult): boolean => run.result.outcome === 'COMPLETED';

export type SkillRunResult =
  | Readonly<{ outcome: 'REJECTED'; errors: readonly SkillValidationError[] }>
  | Readonly<{ outcome: 'STALE'; skillId: string }>
  | Readonly<{ outcome: 'PRECONDITION_FAILED'; skillId: string; failedPreconditionId: string }>
  | Readonly<{ outcome: 'PROCEDURE_FAILED'; skillId: string; procedureRun: ProcedureRunResult; rollbackRun: ProcedureRunResult | null }>
  | Readonly<{ outcome: 'VALIDATION_FAILED'; skillId: string; failedValidationId: string; procedureRun: ProcedureRunResult }>
  | Readonly<{ outcome: 'COMPLETED'; skillId: string; procedureRun: ProcedureRunResult }>
  | Readonly<{ outcome: 'UNEXPECTED_FAILURE'; skillId: string; error: SkillError }>;

export type SkillRunnerDeps = Readonly<{
  preconditionChecker: PreconditionChecker;
  validationChecker: ValidationChecker;
  playwrightWorker?: PlaywrightProcedureRunner;
  computerUseWorker?: ComputerUseProcedureRunner;
}>;

export class SkillRunner {
  private readonly deps: SkillRunnerDeps;

  constructor(deps: SkillRunnerDeps) {
    this.deps = deps;
  }

  private async runProcedure(procedure: SkillProcedure, signal: AbortSignal): Promise<ProcedureRunResult> {
    if (procedure.kind === 'PLAYWRIGHT') {
      if (!this.deps.playwrightWorker) {
        throw createSkillError('RHIA_SKILL_UNEXPECTED_FAILURE', 'El skill requiere un PlaywrightWorker pero no fue inyectado.');
      }
      return { kind: 'PLAYWRIGHT', result: await this.deps.playwrightWorker.run(procedure.scenario) };
    }
    if (!this.deps.computerUseWorker) {
      throw createSkillError('RHIA_SKILL_UNEXPECTED_FAILURE', 'El skill requiere un ComputerUseWorker pero no fue inyectado.');
    }
    void signal;
    return { kind: 'COMPUTER_USE', result: await this.deps.computerUseWorker.run(procedure.task) };
  }

  /**
   * Ejecuta un skill de principio a fin. `currentToolManifest` es el
   * `ToolManifest` REAL leido del registro AHORA MISMO (nunca cacheado por
   * este worker) -- es la unica forma real de detectar staleness.
   * Validacion final del packet ("Un agente ejecuta skill sin releer
   * historial"): esta funcion solo necesita `skillInput` +
   * `currentToolManifest` + las dependencias inyectadas -- ningun estado
   * implicito de sesiones/ciclos anteriores.
   */
  async run(skillInput: SkillManifest | unknown, currentToolManifest: ToolManifest): Promise<SkillRunResult> {
    const validation = validateSkillManifest(skillInput);
    if (!validation.valid) return { outcome: 'REJECTED', errors: validation.errors };
    const skill = validation.skill;

    // Prueba requerida "Skill stale".
    if (isSkillStale(skill, currentToolManifest)) {
      return { outcome: 'STALE', skillId: skill.id };
    }

    // Accion "Preconditions" + Prueba requerida "Missing precondition":
    // NUNCA se intenta el procedimiento si una precondicion declarada falla.
    for (const precondition of skill.preconditions) {
      const controller = new AbortController();
      const ok = await this.deps.preconditionChecker.check(precondition.id, controller.signal);
      if (!ok) return { outcome: 'PRECONDITION_FAILED', skillId: skill.id, failedPreconditionId: precondition.id };
    }

    let procedureRun: ProcedureRunResult;
    try {
      procedureRun = await this.runProcedure(skill.procedure, new AbortController().signal);
    } catch (rawError) {
      const error = rawError && typeof rawError === 'object' && 'code' in rawError ? (rawError as SkillError) : createSkillError('RHIA_SKILL_UNEXPECTED_FAILURE', 'Fallo inesperado al ejecutar el procedimiento.');
      return { outcome: 'UNEXPECTED_FAILURE', skillId: skill.id, error };
    }

    // Prueba requerida "Tool UI changed": el procedimiento subyacente
    // (Playwright/Computer Use, YA PROBADOS por su propio paquete) es quien
    // detecta un cambio real de UI -- este worker NUNCA reimplementa esa
    // deteccion, solo reacciona a su resultado real. Accion "Rollback/
    // fallback": se intenta UNA vez, mejor esfuerzo, nunca en bucle.
    if (!procedureSucceeded(procedureRun)) {
      let rollbackRun: ProcedureRunResult | null = null;
      if (skill.rollback) {
        try {
          rollbackRun = await this.runProcedure(skill.rollback, new AbortController().signal);
        } catch {
          rollbackRun = null;
        }
      }
      return { outcome: 'PROCEDURE_FAILED', skillId: skill.id, procedureRun, rollbackRun };
    }

    // Criterio "Validation final obligatoria": SIEMPRE se corren TODAS las
    // validaciones declaradas (ya se rechazo en `validateSkillManifest` un
    // manifest sin ninguna) -- un procedimiento exitoso NUNCA se considera
    // `COMPLETED` sin pasar esto.
    for (const validationItem of skill.validations) {
      const controller = new AbortController();
      const ok = await this.deps.validationChecker.check(validationItem.id, controller.signal);
      if (!ok) return { outcome: 'VALIDATION_FAILED', skillId: skill.id, failedValidationId: validationItem.id, procedureRun };
    }

    return { outcome: 'COMPLETED', skillId: skill.id, procedureRun };
  }
}
