import assert from 'node:assert/strict';
import test from 'node:test';
import type { OutreachPolicy, SequenceContext } from '@rhia/outreach-policy';
import { buildTouchPlan } from './touch-plan.js';

const policy: OutreachPolicy = {
  version: '1.0',
  maxProactiveTouches: 3,
  cadenceBusinessDays: [0, 3, 7],
  contactWindow: { startHour: 8, endHour: 20 },
  channels: [
    { channel: 'EMAIL', enabled: true, minimumHoursBetweenTouches: 48 },
    { channel: 'LINKEDIN', enabled: true, minimumHoursBetweenTouches: 72 },
  ],
};

const baseContext = (overrides: Partial<SequenceContext> = {}): SequenceContext => ({
  organizationId: 'org-1',
  sequenceId: 'seq-1',
  subjectKey: 'contact-hash-1',
  timezone: 'America/Guayaquil',
  startedAt: '2026-08-24T14:00:00Z',
  ledger: [],
  stopSignals: [],
  suppressedSubjectKeys: [],
  ...overrides,
});

test('3-touch boundary: buildTouchPlan nunca genera mas de maxProactiveTouches toques', () => {
  const now = new Date('2026-08-24T14:00:00Z');
  const plan = buildTouchPlan(baseContext(), policy, { now });
  assert.equal(plan.outcome, 'PLAN');
  assert.equal(plan.touches.length, 3);
  assert.deepEqual(plan.touches.map((touch) => touch.ordinal), [0, 1, 2]);
  // Canales rotan (channel mix, accion 3 del packet) entre los habilitados.
  assert.deepEqual(plan.touches.map((touch) => touch.channel), ['EMAIL', 'LINKEDIN', 'EMAIL']);
  // Cadencia 0/3/7 (accion 2): cada toque sucesivo cae en o despues de esa cadencia relativa al inicio.
  const days = plan.touches.map((touch) => (new Date(touch.plannedAt).getTime() - new Date('2026-08-24T00:00:00Z').getTime()) / 86_400_000);
  assert.ok(days[0]! < days[1]! && days[1]! < days[2]!);
});

test('mid-sequence reply: buildTouchPlan se detiene STOPPED y no genera toques despues de la respuesta', () => {
  const plan = buildTouchPlan(
    baseContext({
      ledger: [{ idempotencyKey: 'seq-1:touch:1', channel: 'EMAIL', plannedAt: '2026-08-24T14:00:00Z', status: 'REPLIED' }],
    }),
    policy,
  );
  assert.equal(plan.outcome, 'STOPPED');
  if (plan.outcome === 'STOPPED') assert.equal(plan.reason, 'REPLY');
  assert.equal(plan.touches.length, 0);
});

test('opt-out: buildTouchPlan se detiene STOPPED y no genera ningun toque', () => {
  const plan = buildTouchPlan(
    baseContext({
      ledger: [{ idempotencyKey: 'seq-1:touch:1', channel: 'EMAIL', plannedAt: '2026-08-24T14:00:00Z', status: 'OPTED_OUT' }],
    }),
    policy,
  );
  assert.deepEqual(plan, { outcome: 'STOPPED', reason: 'OPT_OUT', touches: [] });
});

test('buildTouchPlan respeta el calendario de feriados cuando se configura (accion 5) y no repite toque en la misma fecha del feriado', () => {
  const now = new Date('2026-08-24T14:00:00Z');
  const withoutHolidays = buildTouchPlan(baseContext(), policy, { now });
  const withHolidays = buildTouchPlan(baseContext(), policy, { now, holidays: ['2026-08-24'] });
  assert.equal(withHolidays.outcome, 'PLAN');
  assert.notEqual(withHolidays.touches[0]!.plannedAt, withoutHolidays.touches[0]!.plannedAt);
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(withHolidays.touches[0]!.plannedAt),
  );
  assert.notEqual(localDate, '2026-08-24');
});

test('sin canales habilitados, buildTouchPlan devuelve COMPLETE sin generar toques', () => {
  const plan = buildTouchPlan(baseContext(), { ...policy, channels: [{ channel: 'EMAIL', enabled: false, minimumHoursBetweenTouches: 48 }] });
  assert.deepEqual(plan, { outcome: 'COMPLETE', reason: 'NO_CHANNEL_ENABLED', touches: [] });
});
