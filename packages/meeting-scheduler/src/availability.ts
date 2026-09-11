// Meeting Scheduler (PH08-T005), acciones 1 ("Consultar disponibilidad") y
// 2 ("Proponer slots"). Criterio de aceptacion "Timezone correcto" y error
// a evitar "Perder timezone": toda comparacion de hora/dia usa
// `Intl.DateTimeFormat` con el `timezone` EXPLICITO de la consulta, nunca
// `Date.getHours()`/metodos de hora local del proceso (mismo patron ya
// verificado por `@rhia/outreach-policy#isWithinContactWindow`, PH03-T003 --
// no se importa ese paquete porque "ventana de contacto de outreach
// proactivo" y "horario laboral para proponer una reunion" son conceptos de
// negocio distintos, aunque la tecnica de comparacion sea la misma; ver
// comentario de `isWithinBusinessHours` abajo).

import type { CalendarSlot } from './contracts.js';

export type BusinessHours = Readonly<{ startHour: number; endHour: number }>;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = { startHour: 9, endHour: 18 };

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const localParts = (date: Date, timezone: string): Readonly<{ weekday: string; hour: number; minute: number }> => {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', hour: '2-digit', hourCycle: 'h23', minute: '2-digit' });
    formatterCache.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { weekday: parts['weekday'] ?? '', hour: Number(parts['hour']), minute: Number(parts['minute']) };
};

/** Mismo criterio de "dia habil" que `isWithinContactWindow` (lunes-viernes en el timezone dado, nunca en UTC/hora del servidor), pero con un horario laboral propio de reuniones (`BusinessHours`, configurable) en vez del contact window de outreach. */
export const isWithinBusinessHours = (instant: string | Date, timezone: string, businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS): boolean => {
  const date = instant instanceof Date ? instant : new Date(instant);
  const local = localParts(date, timezone);
  return !['Sat', 'Sun'].includes(local.weekday) && local.hour >= businessHours.startHour && local.hour < businessHours.endHour;
};

/**
 * Accion 2 ("Proponer slots"): filtra los slots que el adapter real
 * devolvio (accion 1, `CalendarAdapter.queryAvailability`) a solo los que
 * caen dentro del horario laboral real del timezone dado -- nunca inventa
 * un slot que el adapter no devolvio, solo descarta los que no cumplen
 * politica. Slots ya pasados (`now`) tambien se descartan.
 */
export const proposeSlots = (
  availableSlots: readonly CalendarSlot[],
  timezone: string,
  now: Date,
  businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  maxProposals = 3,
): readonly CalendarSlot[] =>
  availableSlots
    .filter((slot) => new Date(slot.start).getTime() > now.getTime())
    .filter((slot) => isWithinBusinessHours(slot.start, timezone, businessHours))
    .slice(0, maxProposals);
