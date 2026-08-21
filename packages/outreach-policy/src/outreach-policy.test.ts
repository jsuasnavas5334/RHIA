import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultRhiaSettings } from '@rhia/config';
import { createOutreachPolicy, isWithinContactWindow, planNextTouch, type SequenceContext, type TouchLedgerEntry } from './index.js';

const settings = structuredClone(defaultRhiaSettings);
settings.cadence.channels[0] = { channel: 'EMAIL', enabled: true, minimumHoursBetweenTouches: 48 };
const policy = createOutreachPolicy(settings);
const base = (overrides: Partial<SequenceContext> = {}): SequenceContext => ({
  organizationId: 'org-1', sequenceId: 'seq-1', subjectKey: 'contact-hash-1',
  timezone: 'America/Guayaquil', startedAt: '2026-08-21T14:00:00Z', ledger: [],
  stopSignals: [], suppressedSubjectKeys: [], ...overrides,
});

test('programa usando timezone del contacto y nunca quiet hours/fin de semana', () => {
  const result = planNextTouch(base({ startedAt: '2026-08-22T02:00:00Z' }), policy, new Date('2026-08-22T02:00:00Z'));
  assert.equal(result.outcome, 'SCHEDULED');
  if (result.outcome === 'SCHEDULED') assert.equal(isWithinContactWindow(result.touch.plannedAt, 'America/Guayaquil', policy), true);
});

test('respuesta, opt-out, reunión, bounce y suppression detienen', () => {
  for (const signal of ['REPLY', 'OPT_OUT', 'MEETING_BOOKED', 'PERMANENT_BOUNCE', 'RISK'] as const) {
    assert.equal(planNextTouch(base({ stopSignals: [signal] }), policy).outcome, 'STOPPED', signal);
  }
  assert.deepEqual(planNextTouch(base({ suppressedSubjectKeys: ['contact-hash-1'] }), policy), { outcome: 'STOPPED', reason: 'SUPPRESSED' });
});

test('retry con igual idempotency key no crea ni cuenta otro toque', () => {
  const existing: TouchLedgerEntry = { idempotencyKey: 'retry-key', channel: 'EMAIL', plannedAt: '2026-08-21T14:00:00Z', status: 'SENT' };
  const result = planNextTouch(base({ ledger: [existing], requestedIdempotencyKey: 'retry-key' }), policy);
  assert.deepEqual(result, { outcome: 'DUPLICATE', touch: existing });
});

test('default termina exactamente al tercer toque', () => {
  const ledger: TouchLedgerEntry[] = [1, 2, 3].map((ordinal) => ({
    idempotencyKey: `seq-1:touch:${ordinal}`, channel: 'EMAIL',
    plannedAt: `2026-08-${20 + ordinal}T14:00:00Z`, status: 'SENT',
  }));
  assert.deepEqual(planNextTouch(base({ ledger }), policy), { outcome: 'COMPLETE', reason: 'MAX_TOUCHES_REACHED' });
});

test('override exige tenant, secuencia, aprobación vigente y límite seguro', () => {
  const ledger: TouchLedgerEntry[] = [1, 2, 3].map((ordinal) => ({
    idempotencyKey: `seq-1:touch:${ordinal}`, channel: 'EMAIL', plannedAt: `2026-08-${20 + ordinal}T14:00:00Z`, status: 'SENT',
  }));
  const override = {
    action: 'OUTREACH_POLICY_OVERRIDE' as const, organizationId: 'org-1', sequenceId: 'seq-1',
    approvedByHumanId: 'manager-1', approvedMaxTouches: 4, expiresAt: '2026-09-01T00:00:00Z',
  };
  assert.equal(planNextTouch(base({ ledger, override }), policy, new Date('2026-08-21T00:00:00Z')).outcome, 'SCHEDULED');
  assert.equal(planNextTouch(base({ ledger, override: { ...override, organizationId: 'org-2' } }), policy, new Date('2026-08-21T00:00:00Z')).outcome, 'COMPLETE');
});

test('simulación de 100 secuencias respeta máximo y ventana', () => {
  const timezones = ['America/Guayaquil', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'America/Sao_Paulo'];
  for (let sequence = 0; sequence < 100; sequence += 1) {
    let ledger: TouchLedgerEntry[] = [];
    const context = base({ sequenceId: `seq-${sequence}`, timezone: timezones[sequence % timezones.length] ?? 'America/Guayaquil' });
    for (let ordinal = 0; ordinal < 3; ordinal += 1) {
      const result = planNextTouch({ ...context, ledger }, policy, new Date('2026-08-21T12:00:00Z'));
      assert.equal(result.outcome, 'SCHEDULED');
      if (result.outcome !== 'SCHEDULED') continue;
      assert.equal(isWithinContactWindow(result.touch.plannedAt, context.timezone, policy), true);
      ledger = [...ledger, { ...result.touch, status: 'SENT' }];
    }
    assert.equal(planNextTouch({ ...context, ledger }, policy).outcome, 'COMPLETE');
    assert.equal(new Set(ledger.map((touch) => touch.idempotencyKey)).size, 3);
  }
});
