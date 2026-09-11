// Meeting Scheduler (PH08-T005), accion 6 ("Dashboard KPI"). "Validacion
// final" del packet: "Dashboard muestra funnel hasta effective meeting" --
// `computeMeetingFunnelKpis` es el dato real que alimentaria ese dashboard
// (este paquete no dibuja UI, solo produce el funnel numerico real, mismo
// alcance que otros paquetes puros de PH08 dejan la UI/wiring para el
// caller). Reusa `isEffectiveMeeting` (nunca reimplementa la condicion
// compuesta "attended+qualified" en un segundo lugar).

import { isEffectiveMeeting } from './attendance.js';
import type { Meeting } from './schema.js';

export type MeetingFunnelKpis = Readonly<{
  booked: number;
  cancelled: number;
  noShow: number;
  attended: number;
  effective: number;
  /** `effective / booked`, `0` cuando `booked === 0` (nunca `NaN`/`Infinity`). */
  effectiveRate: number;
}>;

/**
 * `booked` cuenta TODO meeting que llego a reservarse alguna vez (cualquier
 * status excepto `CANCELLED` -- un `RESCHEDULED`/`COMPLETED`/`NO_SHOW`
 * sigue siendo, por definicion, un meeting que SI se booked). Error a
 * evitar del packet, "Contar booked como attended": `attended` cuenta
 * SOLO `meeting.attended === true`, nunca se infiere de `booked` ni de
 * `status`.
 */
export const computeMeetingFunnelKpis = (meetings: readonly Meeting[]): MeetingFunnelKpis => {
  const booked = meetings.filter((meeting) => meeting.status !== 'CANCELLED').length;
  const cancelled = meetings.filter((meeting) => meeting.status === 'CANCELLED').length;
  const noShow = meetings.filter((meeting) => meeting.status === 'NO_SHOW').length;
  const attended = meetings.filter((meeting) => meeting.attended).length;
  const effective = meetings.filter(isEffectiveMeeting).length;
  return { booked, cancelled, noShow, attended, effective, effectiveRate: booked === 0 ? 0 : effective / booked };
};
