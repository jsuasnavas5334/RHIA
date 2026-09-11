// Meeting Scheduler (PH08-T005), acciones 3 ("Crear event") y 4
// ("Registrar status"). Reusa (no reimplementa) `IdempotencyStore`/
// `stableFingerprint` de `@rhia/channel-gateway` -- son utilidades
// GENERICAS de idempotencia (organizationId + operation + key + fingerprint
// + snapshot), ya reales y probadas por PH08-T001, no especificas de
// envio de canal; mismo principio "reusar antes de crecer" que el
// proyecto aplica a tablas de datos, aplicado aqui a un modulo de codigo.
// Tambien reusa `canTransition('meeting', from, to)` de `@rhia/domain`
// (real maquina de estados, `states.ts`) para GUARDAR cada cambio de
// `status` -- ningun cambio se aplica sin confirmar primero que la maquina
// real lo permite (ver "CORRECCION" en schema.ts para el detalle de por
// que esto se corrigio en este mismo ciclo).
//
// Igual que `ChannelGateway.send`, solo se registra en el idempotency
// store un resultado DEFINITIVO (creacion de event `SUCCEEDED`) -- un
// `PROVIDER_FAILED` (accion requerida "Calendar provider outage") nunca se
// registra, para que un retry real despues de que el proveedor se
// recupere pueda intentarlo de nuevo sin quedar bloqueado por un fallo que
// nunca llego a confirmarse.

import { canTransition } from '@rhia/domain';
import { stableFingerprint, type IdempotencyStore } from '@rhia/channel-gateway';
import type { CalendarAdapter, CalendarError, CalendarSlot, CreateCalendarEventRequest } from './contracts.js';
import type { Meeting, MeetingStatus } from './schema.js';

/** El esquema real de `meeting` no guarda una duracion -- se asume una duracion fija SOLO para el chequeo de superposicion de horarios (nunca se persiste). */
export const DEFAULT_MEETING_DURATION_MINUTES = 30;

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean => aStart < bEnd && bStart < aEnd;

export type InvalidTransitionOutcome = Readonly<{ outcome: 'INVALID_TRANSITION'; from: MeetingStatus; to: MeetingStatus }>;

/**
 * Accion requerida "Double booking": busca, dentro del ledger REAL de
 * meetings ya existentes que el caller entrega (nunca inventado por este
 * paquete), un meeting del MISMO contacto cuyo horario se superpone con el
 * slot solicitado y cuyo status no sea `CANCELLED` (un meeting cancelado
 * libera su horario). Alcance deliberado: la tabla real `meeting` no
 * guarda un `organizerRef`, asi que el conflicto se detecta por `contactId`
 * -- el mismo contacto no puede tener dos reuniones reales superpuestas.
 */
export const findDoubleBookingConflict = (
  existingMeetings: readonly Meeting[],
  contactId: string,
  slot: CalendarSlot,
  durationMinutes: number = DEFAULT_MEETING_DURATION_MINUTES,
): Meeting | undefined => {
  const requestedStart = new Date(slot.start);
  const requestedEnd = new Date(slot.end);
  return existingMeetings.find((meeting) => {
    if (meeting.contactId !== contactId || meeting.status === 'CANCELLED') return false;
    const meetingStart = new Date(meeting.scheduledAt);
    const meetingEnd = new Date(meetingStart.getTime() + durationMinutes * 60_000);
    return overlaps(requestedStart, requestedEnd, meetingStart, meetingEnd);
  });
};

export type BookMeetingInput = Readonly<{
  organizationId: string;
  opportunityId: string;
  contactId: string;
  organizerRef: string;
  attendeeRef: string;
  slot: CalendarSlot;
  timezone: string;
  subject: string;
  idempotencyKey: string;
  existingMeetings: readonly Meeting[];
  newId: () => string;
  now: () => Date;
}>;

export type BookMeetingOutcome =
  | Readonly<{ outcome: 'BOOKED'; meeting: Meeting; deduplicated: boolean }>
  | Readonly<{ outcome: 'DOUBLE_BOOKED'; conflictingMeeting: Meeting }>
  | Readonly<{ outcome: 'PROVIDER_FAILED'; error: CalendarError }>;

const BOOK_OPERATION = 'meeting.book';

/** Un booking nuevo siempre nace en `BOOKED` -- el estado `initial` real de `stateMachines.meeting` (@rhia/domain) -- por eso no necesita `canTransition`, a diferencia de las transiciones sobre un meeting ya existente abajo. */
export const bookMeeting = async (
  input: BookMeetingInput,
  adapter: CalendarAdapter,
  idempotency: IdempotencyStore,
  signal?: AbortSignal,
): Promise<BookMeetingOutcome> => {
  const fingerprint = stableFingerprint({ contactId: input.contactId, slot: input.slot, organizerRef: input.organizerRef });
  const idempotencyKeyInput = { organizationId: input.organizationId, operation: BOOK_OPERATION, idempotencyKey: input.idempotencyKey };

  const existing = await idempotency.get<Meeting>(idempotencyKeyInput);
  if (existing.found && existing.fingerprint === fingerprint) {
    return { outcome: 'BOOKED', meeting: existing.resourceSnapshot, deduplicated: true };
  }

  const conflict = findDoubleBookingConflict(input.existingMeetings, input.contactId, input.slot);
  if (conflict) return { outcome: 'DOUBLE_BOOKED', conflictingMeeting: conflict };

  const request: CreateCalendarEventRequest = {
    idempotencyKey: input.idempotencyKey,
    organizationId: input.organizationId,
    organizerRef: input.organizerRef,
    attendeeRef: input.attendeeRef,
    slot: input.slot,
    timezone: input.timezone,
    subject: input.subject,
  };
  const result = await adapter.createEvent(request, signal);
  if (result.status === 'FAILED') return { outcome: 'PROVIDER_FAILED', error: result.error };

  const now = input.now().toISOString();
  const meeting: Meeting = {
    id: input.newId(),
    organizationId: input.organizationId,
    opportunityId: input.opportunityId,
    contactId: input.contactId,
    scheduledAt: input.slot.start,
    timezone: input.timezone,
    status: 'BOOKED',
    qualificationStatus: 'UNQUALIFIED',
    attended: false,
    outcome: null,
    calendarEventId: result.calendarEventId,
    createdAt: now,
    updatedAt: now,
  };
  await idempotency.record({ key: idempotencyKeyInput, fingerprint, resourceType: 'meeting', resourceId: meeting.id, resourceSnapshot: meeting });
  return { outcome: 'BOOKED', meeting, deduplicated: false };
};

export type RescheduleMeetingOutcome =
  | Readonly<{ outcome: 'RESCHEDULED'; meeting: Meeting; previousScheduledAt: string }>
  | Readonly<{ outcome: 'DOUBLE_BOOKED'; conflictingMeeting: Meeting }>
  | Readonly<{ outcome: 'PROVIDER_FAILED'; error: CalendarError }>
  | InvalidTransitionOutcome;

/**
 * Accion requerida "Reschedule": libera el event real del proveedor
 * (`cancelEvent`) antes de crear uno nuevo -- nunca deja dos eventos reales
 * simultaneos para el mismo meeting. Si CUALQUIER paso falla (transicion
 * invalida, conflicto, cancelar el viejo, o crear el nuevo), el meeting
 * original se devuelve SIN modificar (nunca queda en un estado intermedio
 * inconsistente).
 *
 * Nota de alcance sobre la maquina real (`stateMachines.meeting`,
 * @rhia/domain): `RESCHEDULED` es un estado TERMINAL ahi -- una vez que
 * ESTE registro de meeting se marca `RESCHEDULED`, la maquina real ya no
 * permite ninguna transicion adicional sobre el (`canTransition` lo
 * rechazaria). Esto modela que la fila deberia considerarse superada por
 * una nueva reserva -- pero la tabla real `meeting` no tiene una columna
 * para enlazar "reemplazada por" (fuera de alcance de este ciclo, ver
 * docs/progress/PH08-T005.md "Fuera de alcance"), asi que esta funcion
 * actualiza `scheduledAt`/`timezone`/`calendarEventId` en la MISMA fila y
 * la deja en `RESCHEDULED` -- un segundo reschedule sobre esa misma fila
 * ya no seria posible via esta funcion (protegido automaticamente por el
 * chequeo de transicion, no por una regla nueva de este paquete).
 */
export const rescheduleMeeting = async (
  meeting: Meeting,
  newSlot: CalendarSlot,
  newTimezone: string,
  adapter: CalendarAdapter,
  otherMeetings: readonly Meeting[],
  now: () => Date,
  signal?: AbortSignal,
): Promise<RescheduleMeetingOutcome> => {
  if (!canTransition('meeting', meeting.status, 'RESCHEDULED')) {
    return { outcome: 'INVALID_TRANSITION', from: meeting.status, to: 'RESCHEDULED' };
  }

  const conflict = findDoubleBookingConflict(otherMeetings, meeting.contactId, newSlot);
  if (conflict) return { outcome: 'DOUBLE_BOOKED', conflictingMeeting: conflict };

  if (meeting.calendarEventId) {
    const cancelResult = await adapter.cancelEvent(meeting.calendarEventId, signal);
    if (cancelResult.status === 'FAILED') return { outcome: 'PROVIDER_FAILED', error: cancelResult.error };
  }

  const createResult = await adapter.createEvent(
    {
      idempotencyKey: `${meeting.id}:reschedule:${newSlot.start}`,
      organizationId: meeting.organizationId,
      organizerRef: meeting.organizationId,
      attendeeRef: meeting.contactId,
      slot: newSlot,
      timezone: newTimezone,
      subject: `Reunion reprogramada (meeting ${meeting.id})`,
    },
    signal,
  );
  if (createResult.status === 'FAILED') return { outcome: 'PROVIDER_FAILED', error: createResult.error };

  const updatedAt = now().toISOString();
  const updated: Meeting = {
    ...meeting,
    scheduledAt: newSlot.start,
    timezone: newTimezone,
    status: 'RESCHEDULED',
    calendarEventId: createResult.calendarEventId,
    updatedAt,
  };
  return { outcome: 'RESCHEDULED', meeting: updated, previousScheduledAt: meeting.scheduledAt };
};

export type CancelMeetingOutcome =
  | Readonly<{ outcome: 'CANCELLED'; meeting: Meeting }>
  | Readonly<{ outcome: 'PROVIDER_FAILED'; error: CalendarError }>
  | InvalidTransitionOutcome;

export const cancelMeeting = async (meeting: Meeting, adapter: CalendarAdapter, now: () => Date, signal?: AbortSignal): Promise<CancelMeetingOutcome> => {
  if (!canTransition('meeting', meeting.status, 'CANCELLED')) {
    return { outcome: 'INVALID_TRANSITION', from: meeting.status, to: 'CANCELLED' };
  }
  if (meeting.calendarEventId) {
    const cancelResult = await adapter.cancelEvent(meeting.calendarEventId, signal);
    if (cancelResult.status === 'FAILED') return { outcome: 'PROVIDER_FAILED', error: cancelResult.error };
  }
  return { outcome: 'CANCELLED', meeting: { ...meeting, status: 'CANCELLED', updatedAt: now().toISOString() } };
};

export type MarkNoShowOutcome = Readonly<{ outcome: 'NO_SHOW'; meeting: Meeting }> | InvalidTransitionOutcome;

/**
 * Accion requerida "No-show". Operacion PURA (no llama al adapter -- un
 * no-show no cambia nada en el calendario real, solo el registro interno):
 * SIEMPRE deja `attended: false` de forma explicita -- criterio "Booked y
 * attended separados"/error a evitar "Contar booked como attended": un
 * meeting `BOOKED` que termina en `NO_SHOW` (estado real de
 * `stateMachines.meeting`) nunca pasa por `attended: true`.
 */
export const markNoShow = (meeting: Meeting, now: () => Date): MarkNoShowOutcome => {
  if (!canTransition('meeting', meeting.status, 'NO_SHOW')) {
    return { outcome: 'INVALID_TRANSITION', from: meeting.status, to: 'NO_SHOW' };
  }
  return {
    outcome: 'NO_SHOW',
    meeting: { ...meeting, status: 'NO_SHOW', attended: false, outcome: 'NO_SHOW', updatedAt: now().toISOString() },
  };
};
