import assert from 'node:assert/strict';
import test from 'node:test';
import type { Fact } from '@rhia/evidence-pipeline';
import type { ContextPack } from './context-pack.js';
import { generateMessage, renderFactMention } from './generate.js';

const makeFact = (overrides: Partial<Fact> = {}): Fact => ({
  id: 'fact-1',
  organizationId: 'org-1',
  subjectType: 'COMPANY',
  subjectId: 'sub-1',
  predicate: 'EMPLOYEE_COUNT',
  value: { count: 120, unit: 'employees' },
  confidence: 0.9,
  supportingEvidenceIds: ['evidence-1'],
  ...overrides,
});

const emptyContextPack: ContextPack = { organizationId: 'org-1', subjectType: 'COMPANY', subjectId: 'sub-1', facts: [], inferences: [] };

test('renderFactMention solo traduce predicates conocidos (EMPLOYEE_COUNT/FOUNDED_YEAR/HEADQUARTERS_LOCATION), nunca adivina uno desconocido', () => {
  assert.equal(renderFactMention('EMPLOYEE_COUNT', { count: 50, unit: 'employees' }), '50 empleados');
  assert.equal(renderFactMention('FOUNDED_YEAR', { year: 1998 }), 'se fundo en 1998');
  assert.equal(renderFactMention('HEADQUARTERS_LOCATION', { location: 'Quito' }), 'tiene su sede en Quito');
  assert.equal(renderFactMention('SOME_UNKNOWN_PREDICATE', { anything: 1 }), null);
  assert.equal(renderFactMention('EMPLOYEE_COUNT', { count: 'no-es-numero' }), null);
});

test('sin inventar claims: sin un Fact EMPLOYEE_COUNT en el ContextPack, el mensaje generado nunca menciona empleados', () => {
  const message = generateMessage({ contextPack: emptyContextPack, channel: 'EMAIL', touchOrdinal: 1, recipientName: 'Ana' });
  assert.ok(!/emplead/i.test(message.body), 'el body no debe mencionar empleados sin soporte');
  assert.deepEqual(message.usedFactIds, []);
});

test('sin inventar claims: con un Fact EMPLOYEE_COUNT real, el mensaje generado usa EXACTAMENTE ese valor y registra el fact usado', () => {
  const fact = makeFact({ value: { count: 340, unit: 'employees' } });
  const contextPack: ContextPack = { ...emptyContextPack, facts: [fact] };
  const message = generateMessage({ contextPack, channel: 'EMAIL', touchOrdinal: 1, recipientName: 'Ana' });
  assert.ok(message.body.includes('340 empleados'), 'debe mencionar el numero exacto del fact');
  assert.deepEqual(message.usedFactIds, [fact.id]);
});

test('tono por canal: EMAIL usa parrafos separados y asunto; WHATSAPP es corto, sin asunto ni saltos de parrafo', () => {
  const email = generateMessage({ contextPack: emptyContextPack, channel: 'EMAIL', touchOrdinal: 1, recipientName: 'Ana' });
  const whatsapp = generateMessage({ contextPack: emptyContextPack, channel: 'WHATSAPP', touchOrdinal: 1, recipientName: 'Ana' });
  assert.notEqual(email.subject, null);
  assert.equal(whatsapp.subject, null);
  assert.ok(email.body.includes('\n\n'), 'EMAIL debe tener parrafos separados');
  assert.ok(!whatsapp.body.includes('\n'), 'WHATSAPP debe ser un bloque corto sin saltos de parrafo');
  assert.ok(whatsapp.body.length < email.body.length, 'WHATSAPP debe ser mas corto que EMAIL (tono por canal)');
});

test('cada canal tiene una plantilla registrada para el primer toque (EMAIL/LINKEDIN/WHATSAPP)', () => {
  for (const channel of ['EMAIL', 'LINKEDIN', 'WHATSAPP'] as const) {
    const message = generateMessage({ contextPack: emptyContextPack, channel, touchOrdinal: 1, recipientName: 'Ana' });
    assert.equal(message.channel, channel);
    assert.ok(message.body.length > 0);
  }
});

test('cada mensaje generado incluye una clausula de opt-out real (nunca se omite)', () => {
  for (const channel of ['EMAIL', 'LINKEDIN', 'WHATSAPP'] as const) {
    const message = generateMessage({ contextPack: emptyContextPack, channel, touchOrdinal: 1, recipientName: 'Ana' });
    assert.ok(/opt-out|unsubscribe|dejar de recibir|"no"|"stop"/i.test(message.body), `${channel} debe incluir opt-out`);
  }
});
