// PH07-T005 -- orquestador (`decideNextBestAction`). Combina policy.ts
// (reglas) + model-fallback.ts (modelo, solo cuando las reglas no bastan) +
// un fallback seguro final -- garantiza el criterio de aceptacion "Cada
// oportunidad activa tiene next action o reason" y evita por construccion
// el error "Oportunidad sin siguiente accion": esta funcion SIEMPRE
// devuelve una NBADecision, nunca `null`/`undefined`.
import { actionRequiresApproval } from './catalog.js';
import { decideWithModel, type ModelDecisionDeps } from './model-fallback.js';
import { applyPolicy } from './policy.js';
import type { NBADecision, NBAInput, NBAPolicyConfig } from './schema.js';
import { addDays, addHours } from './time.js';

function fallbackNextActionAt(input: NBAInput, config: NBAPolicyConfig): string {
  return addDays(input.now, config.waitWindowDays);
}

/** Ventana por defecto para una decision que vino del modelo -- el modelo
 * elige QUE accion, pero CUANDO (accion 5, "Programar next_action_at") lo
 * sigue decidiendo la policy configurada, nunca un plazo inventado por el
 * modelo (consistente con "Score opaco de IA" -- ninguna fecha sin
 * justificacion trazable a la config). */
function modelNextActionAt(action: NBADecision['action'], input: NBAInput, config: NBAPolicyConfig): string | null {
  switch (action) {
    case 'CONTACT':
      return addHours(input.now, config.proactiveContactWindowHours);
    case 'RESEARCH':
      return addHours(input.now, config.researchWindowHours);
    case 'REVALIDATE':
      return addDays(input.now, config.revalidateWindowDays);
    case 'WAIT':
      return addDays(input.now, config.waitWindowDays);
    case 'DISCARD':
      return null;
  }
}

/**
 * Punto de entrada del motor. `modelDeps === null` es una configuracion
 * valida (ej. un caller que todavia no tiene Model Router configurado) --
 * en ese caso, cualquier caso ambiguo cae directo al fallback seguro sin
 * intentar el modelo.
 */
export async function decideNextBestAction(
  input: NBAInput,
  config: NBAPolicyConfig,
  modelDeps: ModelDecisionDeps | null,
): Promise<NBADecision> {
  const ruleDecision = applyPolicy(input, config);
  if (ruleDecision !== null) return ruleDecision;

  if (modelDeps !== null) {
    const modelOutcome = await decideWithModel(input, modelDeps);
    if (modelOutcome !== null) {
      return {
        opportunityId: input.opportunityId,
        action: modelOutcome.action,
        rationale: `${modelOutcome.rationale} (decidido por modelo ${modelOutcome.provider}/${modelOutcome.model}` +
          `${modelOutcome.confidence !== null ? `, confidence ${modelOutcome.confidence.toFixed(2)}` : ''}; ninguna regla determinista aplicaba).`,
        source: 'MODEL',
        requiresApproval: actionRequiresApproval(modelOutcome.action),
        nextActionAt: modelNextActionAt(modelOutcome.action, input, config),
        policyVersion: config.policyVersion,
        decidedAt: input.now,
      };
    }
  }

  return {
    opportunityId: input.opportunityId,
    action: 'WAIT',
    rationale: 'Ninguna regla determinista aplico y el modelo no estuvo disponible, no respondio, o devolvio una ' +
      'accion fuera del catalogo; se aplica espera segura por defecto para no dejar la oportunidad sin proxima accion.',
    source: 'FALLBACK',
    requiresApproval: false,
    nextActionAt: fallbackNextActionAt(input, config),
    policyVersion: config.policyVersion,
    decidedAt: input.now,
  };
}
