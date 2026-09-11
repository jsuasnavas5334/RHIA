// PH07-T004 -- contratos locales de Opportunity Scoring. Se definen aqui (no
// en @rhia/contracts) por la misma decision de ubicacion que
// PH05-T002/PH06-T002/T003/T004/PH07-T002: el Task Packet solo senala
// "scoring" como area afectada, sin workspace previo. El resultado
// (`OpportunityScoreResultSchema`) esta pensado para escribirse directo en
// `opportunity.score`/`opportunity.score_version` (packages/db/src/
// schema.ts, PH03-T001 -- `numeric(6,3)`/`text`, ambas columnas YA
// EXISTENTES, confirmado con grep que apps/core-api/src/contracts.ts
// todavia las trata como literales fijos `0`/`'core-v1'` -- ver "Fuera de
// alcance" en docs/progress/PH07-T004.md) cuando exista un caller real con
// senales reales que aportar -- este paquete no inventa esas senales,
// solo el motor de scoring en si (acciones 1, 2, 5, 6 del packet).

import { z } from 'zod';

// Accion 1, "Definir componentes". Lista chica y estable (igual que
// `RoleAreaSchema` en @rhia/contact-discovery) -- agregar un componente
// nuevo no rompe el motor de combinacion (ver scoring.ts), que es agnostico
// a CUALES componentes existen.
export const ScoreComponentIdSchema = z.enum(['FIT', 'SIGNAL', 'CONTACTABILITY', 'TIMING', 'GEO_PRIORITY', 'EVIDENCE']);
export type ScoreComponentId = z.infer<typeof ScoreComponentIdSchema>;

// Accion 2, "Configurar pesos". Todos los pesos son configurables por el
// llamador (nunca hardcodeados en el motor) -- `DEFAULT_SCORING_WEIGHTS` en
// scoring.ts es solo el valor por defecto, no una constante que el motor
// use directamente.
export const ScoringWeightsSchema = z
  .object({
    FIT: z.number().min(0).max(1),
    SIGNAL: z.number().min(0).max(1),
    CONTACTABILITY: z.number().min(0).max(1),
    TIMING: z.number().min(0).max(1),
    GEO_PRIORITY: z.number().min(0).max(1),
    EVIDENCE: z.number().min(0).max(1),
  })
  .strict();
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;

// Accion 6, "Explicar score": una entrada de breakdown por componente, con
// el porque (rationale) -- "Score explicable" (criterio de aceptacion)
// nunca es un numero solo, siempre viene con esto.
export const ScoreBreakdownEntrySchema = z
  .object({
    component: ScoreComponentIdSchema,
    rawScore: z.number().min(0).max(1),
    weight: z.number().min(0).max(1),
    contribution: z.number().min(0).max(1),
    rationale: z.string().min(1).max(400),
  })
  .strict();
export type ScoreBreakdownEntry = z.infer<typeof ScoreBreakdownEntrySchema>;

// Accion 5, "Versionar score". `scoreVersion` viaja SIEMPRE junto al score
// -- nunca se persiste un score sin saber con que version/pesos se calculo
// (Pruebas requeridas: "Score versioning").
export const OpportunityScoreResultSchema = z
  .object({
    score: z.number().min(0).max(1),
    scoreVersion: z.string().min(1).max(80),
    breakdown: z.array(ScoreBreakdownEntrySchema).length(6),
  })
  .strict();
export type OpportunityScoreResult = z.infer<typeof OpportunityScoreResultSchema>;
