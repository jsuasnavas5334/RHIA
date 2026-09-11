// Helper de pruebas SOLO para este paquete (no se exporta desde index.ts,
// mismo patron de aislamiento que `testing/fake-transport.ts` de
// `@rhia/channel-gateway` -- un adapter falso en memoria para ejercitar
// `scheduler.ts` sin ningun proveedor real de calendario).

import type { CalendarAdapter, CalendarErrorCode, CalendarSlot, CreateCalendarEventRequest, CreateCalendarEventResult } from './contracts.js';
import { createCalendarError } from './contracts.js';

export type FakeCalendarAdapterBehavior = Readonly<{
  createEventOutcome?: 'succeed' | 'fail';
  cancelEventOutcome?: 'succeed' | 'fail';
  failureCode?: CalendarErrorCode;
}>;

export type FakeCalendarAdapter = CalendarAdapter & {
  readonly createEventCalls: CreateCalendarEventRequest[];
  readonly cancelEventCalls: string[];
};

export const createFakeCalendarAdapter = (
  behavior: FakeCalendarAdapterBehavior = {},
  availableSlots: readonly CalendarSlot[] = [],
): FakeCalendarAdapter => {
  const createEventCalls: CreateCalendarEventRequest[] = [];
  const cancelEventCalls: string[] = [];
  let nextEventSeq = 1;

  return {
    providerId: 'fake-calendar',
    createEventCalls,
    cancelEventCalls,
    async queryAvailability() {
      return availableSlots;
    },
    async createEvent(request: CreateCalendarEventRequest): Promise<CreateCalendarEventResult> {
      createEventCalls.push(request);
      if (behavior.createEventOutcome === 'fail') {
        return { status: 'FAILED', error: createCalendarError({ code: behavior.failureCode ?? 'RHIA_CALENDAR_PROVIDER_UNAVAILABLE', message: 'El proveedor de calendario no esta disponible (simulado para pruebas).' }) };
      }
      return { status: 'SUCCEEDED', calendarEventId: `fake-evt-${nextEventSeq++}` };
    },
    async cancelEvent(calendarEventId: string) {
      cancelEventCalls.push(calendarEventId);
      if (behavior.cancelEventOutcome === 'fail') {
        return { status: 'FAILED', error: createCalendarError({ code: behavior.failureCode ?? 'RHIA_CALENDAR_PROVIDER_UNAVAILABLE', message: 'El proveedor de calendario no esta disponible (simulado para pruebas).' }) };
      }
      return { status: 'SUCCEEDED' };
    },
  };
};
