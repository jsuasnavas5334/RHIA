// PH07-T005 -- motor de reglas deterministas (accion 2, "Aplicar policy").
// Cubre las senales claras (respuesta pendiente, sin contacto, score muy
// alto/muy bajo) sin usar ningun modelo. Devuelve `null` SOLO cuando el
// caso es genuinamente ambiguo (score en la banda media sin otra senal
// dominante, o sin score todavia) -- eso, y nada mas, es lo que activa el
// fallback a modelo en decision.ts (accion 3, "Usar model solo cuando rule
// engine no baste"). Ninguna rama de esta funcion depende del pais o de
// ningun otro campo por `if/else` ad-hoc no declarado en NBAPolicyConfig --
// todos los umbrales/ventanas llegan por parametro (mismo principio que
// ScoringWeights en @rhia/opportunity-scoring).
import { actionRequiresApproval, type NBAAction } from './catalog.js';
import type { NBADecision, NBAInput, NBAPolicyConfig } from './schema.js';
import { addDays, addHours, daysBetween } from './time.js';

export const DEFAULT_NBA_POLICY_CONFIG: NBAPolicyConfig = {
  policyVersion: 'nba-v1',
  lowScoreThreshold: 0.35,
  discardScoreThreshold: 0.15,
  highScoreThreshold: 0.7,
  staleAfterDays: 30,
  urgentReplyWindowHours: 4,
  researchWindowHours: 24,
  revalidateWindowDays: 14,
  waitWindowDays: 7,
  proactiveContactWindowHours: 48,
};

function decisionOf(
  input: NBAInput,
  config: NBAPolicyConfig,
  action: NBAAction,
  rationale: string,
  nextActionAt: string | null,
): NBADecision {
  return {
    opportunityId: input.opportunityId,
    action,
    rationale,
    source: 'RULE',
    requiresApproval: actionRequiresApproval(action),
    nextActionAt,
    policyVersion: config.policyVersion,
    decidedAt: input.now,
  };
}

/**
 * Devuelve una NBADecision cuando una regla determinista aplica, o `null`
 * si el caso queda para el modelo (decision.ts) / el fallback seguro.
 */
export function applyPolicy(input: NBAInput, config: NBAPolicyConfig): NBADecision | null {
  // Regla 1 (maxima prioridad): hay una respuesta del contacto esperando la
  // nuestra -- Pruebas requeridas "Reply pending". Prioridad maxima porque
  // dejar un hilo de conversacion sin responder es la forma mas rapida de
  // perder una oportunidad ya calificada, sin importar el score.
  if (input.hasPendingReply) {
    return decisionOf(
      input,
      config,
      'CONTACT',
      'Hay una respuesta del contacto pendiente de continuar la conversacion; se prioriza sobre cualquier otra senal.',
      addHours(input.now, config.urgentReplyWindowHours),
    );
  }

  // Regla 2: sin ningun punto de contacto enviable no hay forma de
  // ejecutar CONTACT -- Pruebas requeridas "Missing contact". Investigar
  // primero, sin importar cuan alto sea el score (un score alto sin
  // contactabilidad real no es accionable).
  if (input.sendableContactPointCount === 0) {
    return decisionOf(
      input,
      config,
      'RESEARCH',
      'No existe ningun punto de contacto enviable (verificado, no INVALID/expirado) para esta oportunidad; se requiere investigacion adicional antes de poder contactar.',
      addHours(input.now, config.researchWindowHours),
    );
  }

  const score = input.scoreResult?.score ?? null;

  // Sin score calculado todavia y con contactabilidad real pero sin senal
  // de respuesta pendiente: no hay base determinista para elegir entre
  // investigar mas, contactar o esperar -- ambiguo, se difiere.
  if (score === null) return null;

  const ageDays = daysBetween(input.createdAt, input.now);

  // Regla 3 (Pruebas requeridas "Low score"): score muy bajo Y la
  // oportunidad ya lleva tiempo sin resolverse -> descarte operativo.
  // Requiere aprobacion (ver catalog.ts) -- nunca se ejecuta solo.
  if (score < config.discardScoreThreshold && ageDays >= config.staleAfterDays) {
    return decisionOf(
      input,
      config,
      'DISCARD',
      `Score ${score.toFixed(3)} por debajo del umbral de descarte (${config.discardScoreThreshold}) y ${ageDays} dias sin resolverse (umbral stale: ${config.staleAfterDays}); se recomienda descarte operativo sujeto a aprobacion.`,
      null,
    );
  }

  // Regla 4 (Pruebas requeridas "Low score"): score bajo pero todavia no
  // stale -- revalidar en vez de descartar de una vez (nunca se descarta
  // solo por un score bajo, ver Errores a evitar de PH07-T004: "no bloquear
  // mercados" es el mismo espiritu -- un score bajo momentaneo no cierra la
  // puerta).
  if (score < config.lowScoreThreshold) {
    return decisionOf(
      input,
      config,
      'REVALIDATE',
      `Score ${score.toFixed(3)} por debajo del umbral de seguimiento (${config.lowScoreThreshold}) pero la oportunidad todavia no esta stale (${ageDays}/${config.staleAfterDays} dias); se programa revalidacion.`,
      addDays(input.now, config.revalidateWindowDays),
    );
  }

  // Regla 5: score alto y contactabilidad confirmada (regla 2 ya lo
  // garantiza en este punto) y sin respuesta pendiente -> contacto
  // proactivo.
  if (score >= config.highScoreThreshold) {
    return decisionOf(
      input,
      config,
      'CONTACT',
      `Score ${score.toFixed(3)} alcanza el umbral de contacto proactivo (${config.highScoreThreshold}) y hay al menos un punto de contacto enviable; se recomienda iniciar contacto.`,
      addHours(input.now, config.proactiveContactWindowHours),
    );
  }

  // Banda media: ni bajo ni alto, contactable, sin respuesta pendiente --
  // genuinamente ambiguo para una regla fija. Se difiere al modelo.
  return null;
}
