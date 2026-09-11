import assert from 'node:assert/strict';
import test from 'node:test';
import type { Fact } from '@rhia/evidence-pipeline';
import type { ContextPack } from './context-pack.js';
import { generateMessage } from './generate.js';
import { lintGeneratedMessage, lintMessage } from './policy-lint.js';

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

// Pruebas requeridas del packet (PH08-T003): Hallucinated claim test, Price test, Opt-out language.

test('Hallucinated claim test: un mensaje que afirma un dato NO presente en el ContextPack se marca UNSUPPORTED_CLAIM', () => {
  const result = lintMessage(
    { subject: null, body: 'Hola, vi que tienen 500 empleados y les escribo para coordinar una llamada. Podes dejar de recibir estos mensajes cuando quieras.' },
    emptyContextPack,
  );
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === 'UNSUPPORTED_CLAIM'));
});

test('Hallucinated claim test: el mismo tipo de mensaje SI pasa cuando el numero coincide con un Fact real del ContextPack', () => {
  const contextPack: ContextPack = { ...emptyContextPack, facts: [makeFact({ value: { count: 500, unit: 'employees' } })] };
  const result = lintMessage(
    { subject: null, body: 'Hola, vi que tienen 500 empleados y les escribo para coordinar una llamada. Podes dejar de recibir estos mensajes cuando quieras.' },
    contextPack,
  );
  assert.equal(result.issues.some((issue) => issue.code === 'UNSUPPORTED_CLAIM'), false);
});

test('Price test: un mensaje que ofrece descuento/precio se marca PRICE_OR_DISCOUNT', () => {
  const withDiscount = lintMessage({ subject: null, body: 'Te ofrezco un 20% de descuento este mes. Podes darte de baja cuando quieras.' }, emptyContextPack);
  assert.equal(withDiscount.passed, false);
  assert.ok(withDiscount.issues.some((issue) => issue.code === 'PRICE_OR_DISCOUNT'));

  const withPrice = lintMessage({ subject: null, body: 'Nuestro precio especial es de $99. Unsubscribe cuando quieras.' }, emptyContextPack);
  assert.ok(withPrice.issues.some((issue) => issue.code === 'PRICE_OR_DISCOUNT'));
});

test('Opt-out language: un mensaje sin clausula de opt-out se marca MISSING_OPT_OUT', () => {
  const result = lintMessage({ subject: null, body: 'Hola, me encantaria coordinar una llamada esta semana.' }, emptyContextPack);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === 'MISSING_OPT_OUT'));
});

test('Opt-out language: un mensaje CON clausula de opt-out reconocible no dispara ese issue', () => {
  const result = lintMessage({ subject: null, body: 'Hola, me encantaria coordinar una llamada. Si preferis, podes darte de baja en cualquier momento.' }, emptyContextPack);
  assert.equal(result.issues.some((issue) => issue.code === 'MISSING_OPT_OUT'), false);
});

test('urgencia falsa sin soporte se marca FALSE_URGENCY', () => {
  const result = lintMessage({ subject: null, body: 'Cupos limitados, ultima oportunidad. Podes darte de baja cuando quieras.' }, emptyContextPack);
  assert.ok(result.issues.some((issue) => issue.code === 'FALSE_URGENCY'));
});

test('cada mensaje real generado por generateMessage (sin facts) pasa el lint completo -- el generador nunca produce un mensaje que su propio lint rechazaria', () => {
  for (const channel of ['EMAIL', 'LINKEDIN', 'WHATSAPP'] as const) {
    const message = generateMessage({ contextPack: emptyContextPack, channel, touchOrdinal: 1, recipientName: 'Ana' });
    const result = lintGeneratedMessage(message, emptyContextPack);
    assert.deepEqual(result.issues, [], `${channel} touch 1 no deberia generar issues: ${JSON.stringify(result.issues)}`);
  }
});

test('un mensaje generado CON un Fact real tambien pasa el lint (el numero mencionado coincide con el fact)', () => {
  const fact = makeFact({ value: { count: 340, unit: 'employees' } });
  const contextPack: ContextPack = { ...emptyContextPack, facts: [fact] };
  const message = generateMessage({ contextPack, channel: 'EMAIL', touchOrdinal: 1, recipientName: 'Ana' });
  const result = lintGeneratedMessage(message, contextPack);
  assert.deepEqual(result.issues, []);
});
