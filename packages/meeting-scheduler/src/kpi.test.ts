import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMeetingFunnelKpis } from './kpi.js';
import type { Meeting } from './schema.js';

const makeMeeting = (overrides: Partial<Meeting>): Meeting => ({
  id: 'meeting-x',
  organizationId: 'org-1',
  opportunityId: 'opp-1',
  contactId: 'contact-x',
  scheduledAt: '2026-09-15T15:00:00Z',
  timezone: 'America/Guayaquil',
  status: 'BOOKED',
  qualificationStatus: 'UNQUALIFIED',
  attended: false,
  outcome: null,
  calendarEventId: 'evt-x',
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
  ...overrides,
});

test('Validacion final del packet -- el funnel real distingue booked/attended/effective sin confundirlos (error a evitar "Contar booked como attended")', () => {
  const meetings: Meeting[] = [
    makeMeeting({ id: 'm1', status: 'BOOKED', attended: false }),
    makeMeeting({ id: 'm2', status: 'ATTENDED', attended: true, qualificationStatus: 'QUALIFIED' }),
    makeMeeting({ id: 'm3', status: 'ATTENDED', attended: true, qualificationStatus: 'UNQUALIFIED' }),
    makeMeeting({ id: 'm4', status: 'NO_SHOW', attended: false }),
    makeMeeting({ id: 'm5', status: 'CANCELLED', attended: false }),
  ];
  const kpis = computeMeetingFunnelKpis(meetings);
  assert.equal(kpis.booked, 4, 'los 4 no cancelados cuentan como booked (m1..m4), el cancelado no');
  assert.equal(kpis.cancelled, 1);
  assert.equal(kpis.noShow, 1);
  assert.equal(kpis.attended, 2, 'solo m2 y m3 asistieron realmente -- un BOOKED sin asistencia real nunca cuenta aqui');
  assert.equal(kpis.effective, 1, 'solo m2 asistio Y califico');
  assert.equal(kpis.effectiveRate, 0.25);
});

test('effectiveRate nunca es NaN/Infinity cuando no hay ningun meeting booked', () => {
  const kpis = computeMeetingFunnelKpis([makeMeeting({ status: 'CANCELLED' })]);
  assert.equal(kpis.booked, 0);
  assert.equal(kpis.effectiveRate, 0);
});

test('con cero meetings el funnel completo es cero, sin errores', () => {
  const kpis = computeMeetingFunnelKpis([]);
  assert.deepEqual(kpis, { booked: 0, cancelled: 0, noShow: 0, attended: 0, effective: 0, effectiveRate: 0 });
});
