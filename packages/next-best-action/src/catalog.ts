// PH07-T005 -- Next Best Action (NBA). Contrato local (no en @rhia/contracts)
// por la misma decision de ubicacion que PH05-T002/T003/PH06-T002/T003/T004/
// PH07-T002/T004: el Task Packet solo senala "decision engine" como area
// afectada, sin workspace previo -- ver docs/progress/PH07-T005.md.
//
// Accion 1, "Definir action catalog": los 5 verbos del Objetivo del packet
// ("investigacion adicional, contacto, espera, revalidacion o descarte
// operativo") y NADA MAS. Lista chica y cerrada -- agregar un verbo nuevo es
// una decision de producto explicita, nunca algo que un modelo puede
// inventar en tiempo de ejecucion (Errores a evitar: "Modelo inventando
// acciones fuera de catalogo").
import { z } from 'zod';

export const NBAActionSchema = z.enum(['RESEARCH', 'CONTACT', 'WAIT', 'REVALIDATE', 'DISCARD']);
export type NBAAction = z.infer<typeof NBAActionSchema>;

export const NBA_ACTIONS: readonly NBAAction[] = NBAActionSchema.options;

/** Nunca confia en un string crudo (ej. salida de un modelo) como accion --
 * SIEMPRE pasa por este guard antes de construir una NBADecision. Ver
 * model-fallback.ts: si el modelo devuelve algo fuera de esta lista, el
 * resultado se descarta por completo (nunca se "corrige" ni se acepta
 * parcialmente). */
export function isCatalogAction(value: unknown): value is NBAAction {
  return NBAActionSchema.safeParse(value).success;
}

/**
 * Accion operativa sensible: descartar una oportunidad es dificil de
 * revertir (coincide con el guardrail del proyecto "Sin borrado de datos ni
 * cambios irreversibles" -- ver data/project-status.json). Por eso, y solo
 * por eso, DISCARD siempre exige aprobacion humana (criterio de aceptacion
 * "Acciones sensibles generan approval"). El resto del catalogo son
 * acciones de seguimiento normal (investigar, contactar, esperar,
 * revalidar) que no comprometen datos ni relaciones de forma irreversible.
 */
const SENSITIVE_ACTIONS: ReadonlySet<NBAAction> = new Set(['DISCARD']);

export function actionRequiresApproval(action: NBAAction): boolean {
  return SENSITIVE_ACTIONS.has(action);
}
