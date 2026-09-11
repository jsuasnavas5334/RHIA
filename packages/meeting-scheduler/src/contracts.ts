// Meeting Scheduler (PH08-T005) -- contratos del Calendar Adapter.
//
// "Contexto necesario" del packet: "Calendar adapter + meeting schema".
// Mismo diseño estructural que `@rhia/channel-gateway/contracts.ts`
// (PH08-T001): un `CalendarAdapter` es un PUERTO tipado que un proveedor
// real (Google Calendar, Outlook/Microsoft Graph, etc.) implementaria --
// este ciclo NO conecta ningun proveedor real (misma limitacion honesta ya
// declarada por `channel-gateway`/`ai-gateway`: sin credencial real
// autorizada). El motor de este paquete (`scheduler.ts`) SOLO depende de
// esta interfaz, nunca de un SDK de proveedor concreto.

export type CalendarSlot = Readonly<{ start: string; end: string }>;

export type AvailabilityQuery = Readonly<{
  organizerRef: string;
  timezone: string;
  from: string;
  to: string;
  slotDurationMinutes: number;
}>;

export type CalendarErrorCode =
  | 'RHIA_CALENDAR_INVALID_REQUEST'
  | 'RHIA_CALENDAR_AUTH_FAILED'
  | 'RHIA_CALENDAR_RATE_LIMITED'
  | 'RHIA_CALENDAR_TIMEOUT'
  | 'RHIA_CALENDAR_PROVIDER_UNAVAILABLE'
  | 'RHIA_CALENDAR_EVENT_NOT_FOUND'
  | 'RHIA_CALENDAR_UNEXPECTED_FAILURE';

const RETRYABLE_CODES: ReadonlySet<CalendarErrorCode> = new Set([
  'RHIA_CALENDAR_RATE_LIMITED',
  'RHIA_CALENDAR_TIMEOUT',
  'RHIA_CALENDAR_PROVIDER_UNAVAILABLE',
]);

export type CalendarError = Readonly<{
  code: CalendarErrorCode;
  message: string;
  retryable: boolean;
  safeDetails: string;
}>;

export const createCalendarError = (input: Readonly<{ code: CalendarErrorCode; message: string; safeDetails?: string }>): CalendarError => ({
  code: input.code,
  message: input.message,
  retryable: RETRYABLE_CODES.has(input.code),
  safeDetails: input.safeDetails ?? input.message,
});

/** Normaliza cualquier excepcion no controlada de un adapter real a un `CalendarError` seguro -- mismo principio que `normalizeUnexpectedError` de `@rhia/channel-gateway/errors.ts`: nunca vuelve a lanzar, nunca incluye el objeto original crudo (podria contener tokens/headers del proveedor real). */
export const normalizeUnexpectedCalendarError = (error: unknown): CalendarError => {
  const message = error instanceof Error ? error.message : 'Fallo no clasificado del adapter de calendario.';
  return createCalendarError({
    code: 'RHIA_CALENDAR_UNEXPECTED_FAILURE',
    message: 'El adapter de calendario fallo de forma inesperada.',
    safeDetails: message.slice(0, 200),
  });
};

export type CreateCalendarEventRequest = Readonly<{
  idempotencyKey: string;
  organizationId: string;
  organizerRef: string;
  attendeeRef: string;
  slot: CalendarSlot;
  timezone: string;
  subject: string;
}>;

export type CreateCalendarEventSuccess = Readonly<{ status: 'SUCCEEDED'; calendarEventId: string }>;
export type CreateCalendarEventFailure = Readonly<{ status: 'FAILED'; error: CalendarError }>;
export type CreateCalendarEventResult = CreateCalendarEventSuccess | CreateCalendarEventFailure;

export type CancelCalendarEventResult = Readonly<{ status: 'SUCCEEDED' }> | CreateCalendarEventFailure;

/**
 * Puerto que un adapter real implementa (accion 1, "Consultar
 * disponibilidad", y accion 3, "Crear event"). `cancelEvent` es lo que
 * `rescheduleMeeting`/`cancelMeeting` (scheduler.ts) usan para liberar el
 * event real antes de crear uno nuevo o marcar el meeting como cancelado --
 * nunca se asume que cancelar localmente cancela tambien en el proveedor
 * real sin llamarlo.
 */
export interface CalendarAdapter {
  readonly providerId: string;
  queryAvailability(query: AvailabilityQuery, signal?: AbortSignal): Promise<readonly CalendarSlot[]>;
  createEvent(request: CreateCalendarEventRequest, signal?: AbortSignal): Promise<CreateCalendarEventResult>;
  cancelEvent(calendarEventId: string, signal?: AbortSignal): Promise<CancelCalendarEventResult>;
}
