// PH07-T005 -- accion 4, "Persist rationale".
//
// `packages/db/src/schema.ts` (PH03-T001) ya tiene una tabla exacta para
// esto -- `decision_record` (`decisionType`/`inputSnapshot`/`output`/
// `rationaleSummary`/`policyVersion`/`modelRunId`), confirmada con grep
// SIN NINGUN caller todavia (a diferencia de `contact_point`, que si tenia
// consumidores parciales antes de PH07-T003). Este paquete es puro (sin
// Postgres, mismo principio que @rhia/opportunity-scoring) -- `apps/
// core-api` es donde vive la persistencia real (ver ContactPointService).
// `toDecisionRecordInput` deja el shape YA listo para insertar en esa tabla
// en cuanto exista un caller real con `organizationId` de tenant (fuera de
// alcance de este paquete, que no conoce tenants) -- revisar esta tabla
// reutilizable ANTES de proponer cualquier columna nueva satisface el
// guardrail del proyecto ("no crecer el esquema de PostgreSQL sin revisar
// si ya existe una tabla reutilizable").
import type { NBADecision, NBAInput } from './schema.js';

export const NBA_DECISION_TYPE = 'NEXT_BEST_ACTION';

/** Shape 1:1 con las columnas de `rhia.decision_record` (menos `id`/
 * `organizationId`/`createdAt`, que asigna el caller real al insertar). */
export interface DecisionRecordInput {
  readonly decisionType: typeof NBA_DECISION_TYPE;
  readonly inputSnapshot: NBAInput;
  readonly output: NBADecision;
  readonly rationaleSummary: string;
  readonly policyVersion: string;
  /** `rhia.model_run.id` cuando `decision.source === 'MODEL'` -- null en RULE/FALLBACK (ver decision_record.model_run_id, nullable). */
  readonly modelRunId: string | null;
}

export function toDecisionRecordInput(input: NBAInput, decision: NBADecision, modelRunId: string | null = null): DecisionRecordInput {
  return {
    decisionType: NBA_DECISION_TYPE,
    inputSnapshot: input,
    output: decision,
    rationaleSummary: decision.rationale,
    policyVersion: decision.policyVersion,
    modelRunId: decision.source === 'MODEL' ? modelRunId : null,
  };
}
