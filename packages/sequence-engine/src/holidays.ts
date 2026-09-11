// Sequence Engine (PH08-T002), accion 5 del Task Packet: "Reschedule por
// feriados/ventanas si se configura". @rhia/outreach-policy (PH03-T003, ya
// DONE) ya resuelve ventana habil (fin de semana + horario) via
// `isWithinContactWindow`, que este modulo REUSA tal cual -- no se
// reimplementa esa regla aqui (mismo principio que evito el packet de
// Channel Gateway: nunca duplicar logica de policy ya cerrada). Lo unico
// nuevo es el calendario de feriados, que OutreachPolicy no conoce todavia.
//
// El calendario es opcional ("si se configura"): si no se pasa, este modulo
// es un no-op y el `plannedAt` que ya calculo OutreachPolicy.planNextTouch
// queda intacto.

import { isWithinContactWindow, type OutreachPolicy } from '@rhia/outreach-policy';

/**
 * Fechas de calendario (no instantes) en las que no debe programarse ningun
 * toque, interpretadas en el timezone del `SequenceContext` al que se
 * aplican -- el mismo timezone que ya usa OutreachPolicy para calcular la
 * ventana de contacto, nunca el timezone del servidor (Errores a evitar del
 * packet PH03-T003, heredado aqui).
 *
 * Formato: 'YYYY-MM-DD' (ISO calendar date, sin hora).
 */
export type HolidayCalendar = readonly string[];

const dateKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();

const localDateKey = (date: Date, timezone: string): string => {
  let formatter = dateKeyFormatterCache.get(timezone);
  if (!formatter) {
    // en-CA formatea como YYYY-MM-DD, que es exactamente el formato que
    // usamos para las entradas del calendario -- evita parsear manualmente.
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dateKeyFormatterCache.set(timezone, formatter);
  }
  return formatter.format(date);
};

export const isHoliday = (instant: string | Date, timezone: string, calendar: HolidayCalendar | undefined): boolean => {
  if (!calendar || calendar.length === 0) return false;
  const date = instant instanceof Date ? instant : new Date(instant);
  return calendar.includes(localDateKey(date, timezone));
};

const MAX_RESCHEDULE_STEPS = 5 * 24 * 4 + 4 * 24 * 4; // ventana habil (5 dias) + hasta 4 dias adicionales de feriados consecutivos, en pasos de 15 min

/**
 * Empuja `plannedAt` hacia adelante (nunca hacia atras -- no debe romper el
 * espaciado minimo entre toques que OutreachPolicy ya calculo) hasta caer en
 * una fecha que sea ventana habil real (`isWithinContactWindow`, reusado) Y
 * que no este en `calendar`. Si no hay calendario configurado, devuelve
 * `plannedAt` sin cambios (no-op real, no solo documentado).
 */
export const rescheduleAroundHolidays = (
  plannedAt: string,
  timezone: string,
  policy: OutreachPolicy,
  calendar: HolidayCalendar | undefined,
): string => {
  if (!calendar || calendar.length === 0) return plannedAt;
  let candidate = new Date(plannedAt);
  for (let step = 0; step < MAX_RESCHEDULE_STEPS; step += 1) {
    if (isWithinContactWindow(candidate, timezone, policy) && !isHoliday(candidate, timezone, calendar)) {
      return candidate.toISOString();
    }
    candidate = new Date(candidate.getTime() + 15 * 60_000);
  }
  throw new Error(`No se encontro ventana habil sin feriado para ${timezone} partiendo de ${plannedAt}.`);
};
