import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryIdempotencyStore } from '@rhia/channel-gateway';
import { bookMeeting, rescheduleMeeting, cancelMeeting, markNoShow, findDoubleBookingConflict } from './scheduler.js';
import { createFakeCalendarAdapter } from './testing.js';
import type { Meeting } from './schema.js';

let idSeq = 1;
const newId = () => `meeting-${idSeq++}`;
const fixedNow = () => new Date('2026-09-14T12:00:00Z');

const baseBookInput = (overrides: Partial<Parameters<typeof bookMeeting>[0]> = {}) => ({
  organizationId: 'org-1',
  opportunityId: 'opp-1',
  contactId: 'contact-1',
  organizerRef: 'sales-rep-1',
  attendeeRef: 'contact-1',
  slot: { start: '2026-09-15T15:00:00Z', end: '2026-09-15T15:30:00Z' },
  timezone: 'America/Guayaquil',
  subject: 'Demo RHIA',
  idempotencyKey: 'book-1',
  existingMeetings: [] as readonly Meeting[],
  newId,
  now: fixedNow,
  ...overrides,
});

test('bookMeeting real crea un event y un Meeting BOOKED con attended=false', async () => {
  const adapter = createFakeCalendarAdapter();
  const idempotency = new InMemoryIdempotencyStore();
  const result = await bookMeeting(baseBookInput(), adapter, idempotency);
  assert.equal(result.outcome, 'BOOKED');
  if (result.outcome === 'BOOKED') {
    assert.equal(result.meeting.status, 'BOOKED');
    assert.equal(result.meeting.attended, false);
    assert.equal(result.meeting.calendarEventId, 'fake-evt-1');
    assert.equal(result.deduplicated, false);
  }
  assert.equal(adapter.createEventCalls.length, 1);
});

test('bookMeeting con la MISMA idempotencyKey y contenido no vuelve a llamar al adapter (deduplicado real)', async () => {
  const adapter = createFakeCalendarAdapter();
  const idempotency = new InMemoryIdempotencyStore();
  const input = baseBookInput();
  const first = await bookMeeting(input, adapter, idempotency);
  const second = await bookMeeting(input, adapter, idempotency);
  assert.equal(adapter.createEventCalls.length, 1, 'el adapter real solo debe llamarse una vez');
  assert.equal(second.outcome, 'BOOKED');
  if (first.outcome === 'BOOKED' && second.outcome === 'BOOKED') {
    assert.equal(second.meeting.id, first.meeting.id);
    assert.equal(second.deduplicated, true);
  }
});

test('Prueba requerida "Double booking" -- el mismo contacto en un horario superpuesto se rechaza sin llamar al adapter', async () => {
  const existingMeeting: Meeting = {
    id: 'meeting-existing',
    organizationId: 'org-1',
    opportunityId: 'opp-1',
    contactId: 'contact-1',
    scheduledAt: '2026-09-15T15:10:00Z',
    timezone: 'America/Guayaquil',
    status: 'BOOKED',
    qualificationStatus: 'UNQUALIFIED',
    attended: false,
    outcome: null,
    calendarEventId: 'fake-evt-existing',
    createdAt: '2026-09-14T00:00:00Z',
    updatedAt: '2026-09-14T00:00:00Z',
  };
  const adapter = createFakeCalendarAdapter();
  const idempotency = new InMemoryIdempotencyStore();
  const result = await bookMeeting(baseBookInput({ existingMeetings: [existingMeeting], idempotencyKey: 'book-2' }), adapter, idempotency);
  assert.equal(result.outcome, 'DOUBLE_BOOKED');
  if (result.outcome === 'DOUBLE_BOOKED') assert.equal(result.conflictingMeeting.id, 'meeting-existing');
  assert.equal(adapter.createEventCalls.length, 0, 'un double booking nunca debe llegar a llamar al proveedor real');
});

test('un meeting CANCELLED en el mismo horario no cuenta como double booking (libera el horario)', () => {
  const cancelled: Meeting = {
    id: 'meeting-cancelled',
    organizationId: 'org-1',
    opportunityId: 'opp-1',
    contactId: 'contact-1',
    scheduledAt: '2026-09-15T15:10:00Z',
    timezone: 'America/Guayaquil',
    status: 'CANCELLED',
    qualificationStatus: 'UNQUALIFIED',
    attended: false,
    outcome: null,
    calendarEventId: null,
    createdAt: '2026-09-14T00:00:00Z',
    updatedAt: '2026-09-14T00:00:00Z',
  };
  const conflict = findDoubleBookingConflict([cancelled], 'contact-1', { start: '2026-09-15T15:00:00Z', end: '2026-09-15T15:30:00Z' });
  assert.equal(conflict, undefined);
});

test('Prueba requerida "Calendar provider outage" -- createEvent fallido nunca produce un Meeting con calendarEventId inventado', async () => {
  const adapter = createFakeCalendarAdapter({ createEventOutcome: 'fail', failureCode: 'RHIA_CALENDAR_PROVIDER_UNAVAILABLE' });
  const idempotency = new InMemoryIdempotencyStore();
  const result = await bookMeeting(baseBookInput({ idempotencyKey: 'book-outage' }), adapter, idempotency);
  assert.equal(result.outcome, 'PROVIDER_FAILED');
  if (result.outcome === 'PROVIDER_FAILED') assert.equal(result.error.code, 'RHIA_CALENDAR_PROVIDER_UNAVAILABLE');
  // Un intento fallido nunca se registra en el idempotency store -- un retry real despues de que el proveedor se recupere debe poder intentarlo de nuevo.
  const retryAdapter = createFakeCalendarAdapter();
  const retryResult = await bookMeeting(baseBookInput({ idempotencyKey: 'book-outage' }), retryAdapter, idempotency);
  assert.equal(retryResult.outcome, 'BOOKED', 'un retry real tras la recuperacion del proveedor debe poder completarse');
});

test('Prueba requerida "Reschedule" -- cancela el event viejo, crea uno nuevo, y preserva el id del meeting', async () => {
  const adapter = createFakeCalendarAdapter();
  const idempotency = new InMemoryIdempotencyStore();
  const booked = await bookMeeting(baseBookInput({ idempotencyKey: 'book-3' }), adapter, idempotency);
  assert.equal(booked.outcome, 'BOOKED');
  if (booked.outcome !== 'BOOKED') return;

  const newSlot = { start: '2026-09-16T15:00:00Z', end: '2026-09-16T15:30:00Z' };
  const rescheduled = await rescheduleMeeting(booked.meeting, newSlot, 'America/Guayaquil', adapter, [], fixedNow);
  assert.equal(rescheduled.outcome, 'RESCHEDULED');
  if (rescheduled.outcome === 'RESCHEDULED') {
    assert.equal(rescheduled.meeting.id, booked.meeting.id, 'el reschedule preserva el mismo meeting, no crea uno nuevo');
    assert.equal(rescheduled.meeting.scheduledAt, newSlot.start);
    assert.equal(rescheduled.meeting.status, 'RESCHEDULED');
    assert.equal(rescheduled.previousScheduledAt, booked.meeting.scheduledAt);
  }
  assert.deepEqual(adapter.cancelEventCalls, ['fake-evt-1'], 'debe liberar el event viejo real antes de crear el nuevo');
  assert.equal(adapter.createEventCalls.length, 2, 'una llamada real por el booking original y otra por el reschedule');
});

test('Reschedule que fallaria al cancelar el event viejo nunca modifica el meeting original', async () => {
  const bookAdapter = createFakeCalendarAdapter();
  const idempotency = new InMemoryIdempotencyStore();
  const booked = await bookMeeting(baseBookInput({ idempotencyKey: 'book-4' }), bookAdapter, idempotency);
  assert.equal(booked.outcome, 'BOOKED');
  if (booked.outcome !== 'BOOKED') return;

  const failingAdapter = createFakeCalendarAdapter({ cancelEventOutcome: 'fail' });
  const result = await rescheduleMeeting(booked.meeting, { start: '2026-09-16T15:00:00Z', end: '2026-09-16T15:30:00Z' }, 'America/Guayaquil', failingAdapter, [], fixedNow);
  assert.equal(result.outcome, 'PROVIDER_FAILED');
  assert.equal(failingAdapter.createEventCalls.length, 0, 'nunca debe crear el event nuevo si no pudo liberar el viejo');
});

test('Prueba requerida "No-show" -- attended se mantiene en false explicitamente, nunca se cuenta como asistido', () => {
  const meeting: Meeting = {
    id: 'meeting-5',
    organizationId: 'org-1',
    opportunityId: 'opp-1',
    contactId: 'contact-1',
    scheduledAt: '2026-09-15T15:00:00Z',
    timezone: 'America/Guayaquil',
    status: 'BOOKED',
    qualificationStatus: 'UNQUALIFIED',
    attended: false,
    outcome: null,
    calendarEventId: 'fake-evt-1',
    createdAt: '2026-09-14T00:00:00Z',
    updatedAt: '2026-09-14T00:00:00Z',
  };
  const result = markNoShow(meeting, fixedNow);
  assert.equal(result.outcome, 'NO_SHOW');
  if (result.outcome !== 'NO_SHOW') return;
  assert.equal(result.meeting.status, 'NO_SHOW');
  assert.equal(result.meeting.attended, false, 'error a evitar del packet: "Contar booked como attended"');
});

test('markNoShow rechaza una transicion invalida (meeting ya CANCELLED) via la maquina real de @rhia/domain', () => {
  const cancelled: Meeting = {
    id: 'meeting-cancelled-2',
    organizationId: 'org-1',
    opportunityId: 'opp-1',
    contactId: 'contact-1',
    scheduledAt: '2026-09-15T15:00:00Z',
    timezone: 'America/Guayaquil',
    status: 'CANCELLED',
    qualificationStatus: 'UNQUALIFIED',
    attended: false,
    outcome: null,
    calendarEventId: null,
    createdAt: '2026-09-14T00:00:00Z',
    updatedAt: '2026-09-14T00:00:00Z',
  };
  const result = markNoShow(cancelled, fixedNow);
  assert.equal(result.outcome, 'INVALID_TRANSITION');
});

test('cancelMeeting real libera el event del proveedor antes de marcar CANCELLED', async () => {
  const adapter = createFakeCalendarAdapter();
  const idempotency = new InMemoryIdempotencyStore();
  const booked = await bookMeeting(baseBookInput({ idempotencyKey: 'book-6' }), adapter, idempotency);
  assert.equal(booked.outcome, 'BOOKED');
  if (booked.outcome !== 'BOOKED') return;
  const result = await cancelMeeting(booked.meeting, adapter, fixedNow);
  assert.equal(result.outcome, 'CANCELLED');
  assert.deepEqual(adapter.cancelEventCalls, ['fake-evt-1']);
});
