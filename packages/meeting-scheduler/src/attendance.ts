// Meeting Scheduler (PH08-T005), accion 5 ("Capturar attended/qualification").
// Criterio de aceptacion "Effective = attended+qualified": `isEffectiveMeeting`
// es la UNICA funcion que decide "efectivo", y exige AMBAS condiciones --
// ni `attended` solo ni `qualificationStatus` solo bastan. Mismo principio
// que otras decisiones binarias del proyecto (p. ej. `buildContextPack` en
// `@rhia/messaging`): una condicion compuesta se calcula en un solo lugar,
// nunca se infiere por separado en distintos módulos.

import { canTransition } from '@rhia/domain';
import type { InvalidTransitionOutcome } from './scheduler.js';
import type { Meeting, QualificationStatus } from './schema.js';

export type RecordAttendanceOutcome = Readonly<{ outcome: 'RECORDED'; meeting: Meeting }> | InvalidTransitionOutcome;

/**
 * Registra que un meeting SI ocurrio (`attended: true`) y su calificacion
 * real. Nunca se llama para un no-show real -- ese caso usa `markNoShow`
 * (scheduler.ts), que fija `attended: false` explicitamente. `status` pasa
 * a `ATTENDED` (valor REAL de `stateMachines.meeting`, @rhia/domain -- ver
 * "CORRECCION" en schema.ts: una version anterior de este mismo ciclo usaba
 * `'COMPLETED'`, que no existe en el contrato real) -- un meeting con
 * `attended: true` siempre esta `ATTENDED`, nunca se queda en `BOOKED`
 * (criterio "Booked y attended separados": son dos campos reales
 * distintos, pero un meeting con asistencia confirmada no puede seguir
 * reportandose como "solo booked"). Guardado con `canTransition('meeting',
 * ...)` -- nunca se registra asistencia sobre un meeting ya `CANCELLED`/
 * `RESCHEDULED`/`NO_SHOW` (estados terminales reales).
 */
export const recordAttendance = (meeting: Meeting, qualificationStatus: QualificationStatus, now: () => Date): RecordAttendanceOutcome => {
  if (!canTransition('meeting', meeting.status, 'ATTENDED')) {
    return { outcome: 'INVALID_TRANSITION', from: meeting.status, to: 'ATTENDED' };
  }
  return {
    outcome: 'RECORDED',
    meeting: { ...meeting, attended: true, qualificationStatus, status: 'ATTENDED', updatedAt: now().toISOString() },
  };
};

/** Criterio de aceptacion "Effective = attended+qualified" -- las DOS condiciones, nunca una sola. */
export const isEffectiveMeeting = (meeting: Meeting): boolean => meeting.attended && meeting.qualificationStatus === 'QUALIFIED';
