import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordAttendance, isEffectiveMeeting } from './attendance.js';
import type { Meeting } from './schema.js';

const now = () => new Date('2026-09-16T18:00:00Z');

const baseMeeting: Meeting = {
  id: 'meeting-1',
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

test('recordAttendance marca attended=true, la calificacion real, y status ATTENDED (valor real de @rhia/domain)', () => {
  const result = recordAttendance(baseMeeting, 'QUALIFIED', now);
  assert.equal(result.outcome, 'RECORDED');
  if (result.outcome !== 'RECORDED') return;
  assert.equal(result.meeting.attended, true);
  assert.equal(result.meeting.qualificationStatus, 'QUALIFIED');
  assert.equal(result.meeting.status, 'ATTENDED');
});

test('recordAttendance rechaza una transicion invalida (meeting ya CANCELLED) via la maquina real de @rhia/domain', () => {
  const result = recordAttendance({ ...baseMeeting, status: 'CANCELLED' }, 'QUALIFIED', now);
  assert.equal(result.outcome, 'INVALID_TRANSITION');
});

test('Criterio "Effective = attended+qualified" -- exige AMBAS condiciones, ninguna por separado basta', () => {
  assert.equal(isEffectiveMeeting({ ...baseMeeting, attended: true, qualificationStatus: 'QUALIFIED' }), true);
  assert.equal(isEffectiveMeeting({ ...baseMeeting, attended: true, qualificationStatus: 'UNQUALIFIED' }), false, 'asistio pero sin calificar no es efectivo');
  assert.equal(isEffectiveMeeting({ ...baseMeeting, attended: false, qualificationStatus: 'QUALIFIED' }), false, 'califica pero no asistio no es efectivo (no debe poder pasar en la practica, pero la funcion no debe fallar-seguro-abierto)');
  assert.equal(isEffectiveMeeting({ ...baseMeeting, attended: true, qualificationStatus: 'POTENTIAL' }), false, 'POTENTIAL (real, @rhia/domain) no es lo mismo que QUALIFIED');
});
