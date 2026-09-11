// Conversation Agent (PH08-T004) -- "Validacion final" del packet:
// "Scripted E2E de objeciones pasa". Este archivo es ese script: cada test
// simula UN turno de conversacion completo (mensaje entrante real ->
// `handleInboundMessage`) para cada una de las 4 "Pruebas requeridas" del
// packet ("Discount request", "Contract term request", "General product
// question", "Hostile/opt-out") mas los 3 "Criterios de aceptacion"
// (descuento crea approval, precio oficial activo se comunica, commitment
// no aprobado se bloquea).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPack } from '@rhia/messaging';
import { handleInboundMessage } from './conversation-agent.js';
import type { PriceBook } from './schema.js';

const emptyContextPack: ContextPack = { organizationId: 'org-1', subjectType: 'COMPANY', subjectId: 'sub-1', facts: [], inferences: [] };

const activePriceBook: PriceBook = {
  id: 'pb-1',
  organizationId: 'org-1',
  countryCode: 'EC',
  currency: 'USD',
  validFrom: '2026-01-01T00:00:00Z',
  validTo: null,
  status: 'ACTIVE',
  items: [{ priceBookId: 'pb-1', productId: 'prod-1', sku: 'RHIA-CORE', productName: 'RHIA Core', unitPrice: 199, minimumQuantity: 1 }],
};

const baseInput = { subjectId: 'contact-1', channel: 'EMAIL' as const, contextPack: emptyContextPack };

test('Pregunta requerida "Discount request" -- crea approval GRANT_DISCOUNT y nunca confirma el descuento', () => {
  const result = handleInboundMessage({ ...baseInput, inboundText: 'Hola, antes de avanzar: podrian hacerme un descuento del 10%?' });
  assert.equal(result.intent, 'DISCOUNT_REQUEST');
  assert.equal(result.action, 'ESCALATE');
  assert.equal(result.approvalDraft?.action, 'GRANT_DISCOUNT');
  assert.equal(result.approvalDraft?.requiresHumanApproval, true);
  assert.equal(result.reply?.safe, true);
  assert.ok(!/\b10\s*%/.test(result.reply?.body ?? ''), 'nunca debe confirmar el porcentaje pedido');
});

test('Pregunta requerida "Contract term request" -- crea approval CHANGE_COMMERCIAL_TERMS', () => {
  const result = handleInboundMessage({ ...baseInput, inboundText: 'Necesitamos cambiar los terminos de pago del contrato antes de firmar.' });
  assert.equal(result.intent, 'COMMERCIAL_TERMS_REQUEST');
  assert.equal(result.action, 'ESCALATE');
  assert.equal(result.approvalDraft?.action, 'CHANGE_COMMERCIAL_TERMS');
});

test('Pregunta requerida "General product question" -- responde dentro de politicas sin escalar', () => {
  const result = handleInboundMessage({ ...baseInput, inboundText: 'Una consulta: como funciona la plataforma en el dia a dia?' });
  assert.equal(result.intent, 'PRODUCT_QUESTION');
  assert.equal(result.action, 'REPLY');
  assert.equal(result.approvalDraft, undefined);
  assert.equal(result.reply?.safe, true);
});

test('Pregunta requerida "Hostile/opt-out" -- caso opt-out suprime la secuencia sin escalar ni responder comercialmente', () => {
  const result = handleInboundMessage({ ...baseInput, inboundText: 'No me escribas mas, dame de baja.' });
  assert.equal(result.intent, 'OPT_OUT');
  assert.equal(result.action, 'SUPPRESS');
  assert.equal(result.stopSignal, 'OPT_OUT');
  assert.equal(result.approvalDraft, undefined);
  assert.equal(result.reply, undefined);
});

test('Pregunta requerida "Hostile/opt-out" -- caso hostil suprime con stopSignal RISK', () => {
  const result = handleInboundMessage({ ...baseInput, inboundText: 'Esto es spam, los voy a denunciar.' });
  assert.equal(result.intent, 'HOSTILE');
  assert.equal(result.action, 'SUPPRESS');
  assert.equal(result.stopSignal, 'RISK');
});

test('Criterio "Precio oficial activo puede comunicarse" -- con price book ACTIVE y sku real, responde con el precio real', () => {
  const result = handleInboundMessage({
    ...baseInput,
    inboundText: 'Cuanto cuesta el plan RHIA Core?',
    priceBook: activePriceBook,
    productSku: 'RHIA-CORE',
  });
  assert.equal(result.intent, 'PRICE_INQUIRY');
  assert.equal(result.action, 'REPLY');
  assert.ok(result.reply?.body.includes('USD 199.00'));
  assert.equal(result.reply?.safe, true);
});

test('Precio oficial NO se comunica si el price book no esta ACTIVE (evita "Responder con precio stale")', () => {
  const result = handleInboundMessage({
    ...baseInput,
    inboundText: 'Cuanto cuesta el plan RHIA Core?',
    priceBook: { ...activePriceBook, status: 'DRAFT' },
    productSku: 'RHIA-CORE',
  });
  assert.equal(result.action, 'REPLY');
  assert.ok(!/\d/.test(result.reply?.body ?? ''), 'sin price book activo, la respuesta no debe mencionar ningun numero');
});

test('Criterio "Commitment no aprobado se bloquea" -- nunca responde con REPLY/confirmacion, siempre ESCALATE', () => {
  const result = handleInboundMessage({ ...baseInput, inboundText: 'Necesito que se comprometan por escrito a este SLA hoy mismo.' });
  assert.equal(result.intent, 'COMMITMENT_REQUEST');
  assert.equal(result.action, 'ESCALATE');
  assert.equal(result.approvalDraft?.action, 'BINDING_COMMITMENT');
  assert.notEqual(result.action, 'REPLY');
});

test('Deteccion de intencion de reunion (accion 6) es independiente de la intencion primaria y coexiste con cualquier accion', () => {
  const withDiscount = handleInboundMessage({ ...baseInput, inboundText: 'Quiero un descuento y tambien agendar una reunion esta semana.' });
  assert.equal(withDiscount.meetingIntentDetected, true);
  assert.equal(withDiscount.action, 'ESCALATE');

  const withQuestion = handleInboundMessage({ ...baseInput, inboundText: 'Como funciona el producto? Podemos coordinar una llamada?' });
  assert.equal(withQuestion.meetingIntentDetected, true);
  assert.equal(withQuestion.action, 'REPLY');

  const withoutMeeting = handleInboundMessage({ ...baseInput, inboundText: 'Como funciona el producto?' });
  assert.equal(withoutMeeting.meetingIntentDetected, false);
});
