// Sequence Engine (PH08-T002), accion 1 ("Crear touch plan"), accion 2
// ("Cadencia 0/3/7 default") y accion 3 ("Channel mix"): las tres ya las
// resuelve `@rhia/outreach-policy#planNextTouch` (cadencia
// `cadenceBusinessDays: [0, 3, 7]` por defecto y rotacion de canales
// habilitados, PH03-T003, ya DONE) -- este modulo NUNCA reimplementa esa
// decision, solo la orquesta hacia adelante para construir una vista previa
// del plan completo de una secuencia (hasta `maxProactiveTouches`) en vez de
// solo el siguiente toque.
//
// Importante (packet, "Errores que debe evitar" heredado de PH03-T003):
// "Crear secuencia nueva para evadir limite". `buildTouchPlan` es de solo
// lectura -- simula el ledger anadiendo los toques hipoteticos como 'SENT'
// unicamente dentro de esta funcion, nunca muta ni persiste nada. El avance
// real de una secuencia (el unico que cuenta para el limite) pasa siempre
// por `advanceSequence` (runner.ts), que usa el `context.ledger` real que le
// entrega el caller -- este modulo no puede usarse para "fabricar" toques
// adicionales que no esten respaldados por el ledger real.

import { planNextTouch, type OutreachPolicy, type SequenceContext, type StopSignal, type TouchLedgerEntry } from '@rhia/outreach-policy';
import { rescheduleAroundHolidays, type HolidayCalendar } from './holidays.js';

export type TouchPlanEntry = TouchLedgerEntry & { readonly ordinal: number };

export type TouchPlanResult =
  | Readonly<{ outcome: 'PLAN'; touches: readonly TouchPlanEntry[] }>
  | Readonly<{ outcome: 'STOPPED'; reason: StopSignal | 'SUPPRESSED'; touches: readonly TouchPlanEntry[] }>
  | Readonly<{ outcome: 'COMPLETE'; reason: 'MAX_TOUCHES_REACHED' | 'NO_CHANNEL_ENABLED'; touches: readonly TouchPlanEntry[] }>;

export type BuildTouchPlanOptions = Readonly<{
  holidays?: HolidayCalendar;
  now?: Date;
}>;

/**
 * Construye una vista previa del plan de toques restantes de una secuencia,
 * respetando el `context.ledger` ya real (nunca lo ignora ni lo reemplaza).
 * Se detiene exactamente donde `planNextTouch` diria que la secuencia para o
 * termina -- nunca genera mas alla de eso.
 */
export const buildTouchPlan = (context: SequenceContext, policy: OutreachPolicy, options: BuildTouchPlanOptions = {}): TouchPlanResult => {
  const now = options.now ?? new Date();
  const touches: TouchPlanEntry[] = [];
  // Cota dura de iteraciones = maxProactiveTouches: planNextTouch nunca deja
  // agendar mas que eso, asi que no hace falta (ni conviene) un margen mayor.
  let ledger = context.ledger;
  for (let iteration = 0; iteration < policy.maxProactiveTouches; iteration += 1) {
    const result = planNextTouch({ ...context, ledger }, policy, now);
    if (result.outcome === 'STOPPED') return { outcome: 'STOPPED', reason: result.reason, touches };
    if (result.outcome === 'COMPLETE') return { outcome: 'COMPLETE', reason: result.reason, touches };
    if (result.outcome === 'DUPLICATE') break; // no aplica en modo preview (sin requestedIdempotencyKey); corta por seguridad.

    const plannedAt = rescheduleAroundHolidays(result.touch.plannedAt, context.timezone, policy, options.holidays);
    const touch: TouchLedgerEntry = { ...result.touch, plannedAt };
    touches.push({ ...touch, ordinal: touches.length });
    // Ledger hipotetico solo para calcular el SIGUIENTE toque del preview;
    // nunca se devuelve ni se persiste -- ver nota de alcance arriba.
    ledger = [...ledger, { ...touch, status: 'SENT' }];
  }
  return { outcome: 'PLAN', touches };
};
