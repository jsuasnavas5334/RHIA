import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Fact } from '@rhia/evidence-pipeline';
import type { ContextPack } from '@rhia/messaging';
import { buildEscalationAcknowledgementReply, buildPriceReply, buildProductQuestionReply } from './reply.js';

const emptyContextPack: ContextPack = { organizationId: 'org-1', subjectType: 'COMPANY', subjectId: 'sub-1', facts: [], inferences: [] };

const makeFact = (overrides: Partial<Fact> = {}): Fact => ({
  id: 'fact-1',
  organizationId: 'org-1',
  subjectType: 'COMPANY',
  subjectId: 'sub-1',
  predicate: 'EMPLOYEE_COUNT',
  value: { count: 80, unit: 'employees' },
  confidence: 0.9,
  supportingEvidenceIds: ['evidence-1'],
  ...overrides,
});

test('la respuesta de escalacion (descuento/terminos/commitment) nunca repite palabras de precio/descuento y pasa el lint completo', () => {
  for (const channel of ['EMAIL', 'LINKEDIN', 'WHATSAPP'] as const) {
    const reply = buildEscalationAcknowledgementReply(channel, emptyContextPack);
    assert.equal(reply.safe, true, JSON.stringify(reply.lint.issues));
    assert.equal(reply.lint.issues.length, 0);
    assert.ok(!/confirmo|garantizo|acepto/i.test(reply.body), 'no debe asumir ni confirmar el compromiso');
  }
});

test('la respuesta de precio oficial comunicado incluye el numero real y se marca safe (excluyendo el PRICE_OR_DISCOUNT esperado)', () => {
  const reply = buildPriceReply('EMAIL', { communicated: true, priceText: 'USD 199.00', item: { priceBookId: 'pb-1', productId: 'prod-1', sku: 'RHIA-CORE', productName: 'RHIA Core', unitPrice: 199, minimumQuantity: 1 }, priceBookId: 'pb-1' }, emptyContextPack);
  assert.ok(reply.body.includes('USD 199.00'));
  assert.equal(reply.safe, true);
  assert.ok(reply.lint.issues.some((issue) => issue.code === 'PRICE_OR_DISCOUNT'), 'el lint generico SI debe detectar el precio (transparencia) aunque no bloquee este caso');
});

test('la respuesta sin precio oficial disponible nunca inventa un numero y pasa el lint completo sin excepciones', () => {
  const reply = buildPriceReply('EMAIL', { communicated: false, reason: 'NO_ACTIVE_PRICE_BOOK' }, emptyContextPack);
  assert.ok(!/\d/.test(reply.body), 'no debe mencionar ningun numero sin un precio oficial real');
  assert.equal(reply.safe, true);
  assert.equal(reply.lint.issues.length, 0);
});

test('la respuesta de pregunta de producto sin ningun Fact real no menciona empleados/fundacion/sede', () => {
  const reply = buildProductQuestionReply('EMAIL', emptyContextPack);
  assert.ok(!/emplead|fundo|sede/i.test(reply.body));
  assert.equal(reply.safe, true);
});

test('la respuesta de pregunta de producto CON un Fact real lo menciona con el valor exacto -- criterio "General product question"', () => {
  const contextPack: ContextPack = { ...emptyContextPack, facts: [makeFact()] };
  const reply = buildProductQuestionReply('EMAIL', contextPack);
  assert.ok(reply.body.includes('80 empleados'));
  assert.equal(reply.safe, true);
  assert.equal(reply.lint.issues.length, 0);
});

test('toda respuesta real incluye una clausula de opt-out reconocible por el lint (MISSING_OPT_OUT nunca aparece)', () => {
  const replies = [
    buildEscalationAcknowledgementReply('WHATSAPP', emptyContextPack),
    buildPriceReply('WHATSAPP', { communicated: false, reason: 'PRODUCT_NOT_FOUND' }, emptyContextPack),
    buildProductQuestionReply('WHATSAPP', emptyContextPack),
  ];
  for (const reply of replies) {
    assert.ok(!reply.lint.issues.some((issue) => issue.code === 'MISSING_OPT_OUT'), JSON.stringify(reply));
  }
});
