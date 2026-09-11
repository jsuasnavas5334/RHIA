import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent, detectMeetingIntent } from './intent.js';

test('discount request se clasifica como DISCOUNT_REQUEST', () => {
  const result = classifyIntent('Hola, me interesa pero quisiera saber si hay algun descuento disponible.');
  assert.equal(result.intent, 'DISCOUNT_REQUEST');
});

test('contract term request se clasifica como COMMERCIAL_TERMS_REQUEST', () => {
  const result = classifyIntent('Antes de avanzar necesitamos revisar los terminos de pago del contrato.');
  assert.equal(result.intent, 'COMMERCIAL_TERMS_REQUEST');
});

test('general product question se clasifica como PRODUCT_QUESTION', () => {
  const result = classifyIntent('Che, una duda: como funciona exactamente el producto?');
  assert.equal(result.intent, 'PRODUCT_QUESTION');
});

test('opt-out real se clasifica como OPT_OUT', () => {
  const result = classifyIntent('No me escribas mas por favor.');
  assert.equal(result.intent, 'OPT_OUT');
});

test('mensaje hostil se clasifica como HOSTILE', () => {
  const result = classifyIntent('Esto es spam, voy a denunciar esta cuenta.');
  assert.equal(result.intent, 'HOSTILE');
});

test('opt-out tiene prioridad sobre una intencion comercial en el mismo mensaje', () => {
  const result = classifyIntent('No me escribas mas, y de paso no me interesa ningun descuento.');
  assert.equal(result.intent, 'OPT_OUT');
});

test('commitment request se clasifica como COMMITMENT_REQUEST', () => {
  const result = classifyIntent('Necesito que se comprometan a firmar hoy mismo con estas condiciones.');
  assert.equal(result.intent, 'COMMITMENT_REQUEST');
});

test('price inquiry se clasifica como PRICE_INQUIRY', () => {
  const result = classifyIntent('Cuanto cuesta el plan mensual?');
  assert.equal(result.intent, 'PRICE_INQUIRY');
});

test('mensaje sin ninguna senal reconocida es UNKNOWN', () => {
  const result = classifyIntent('Buenos dias, gracias por el mensaje.');
  assert.equal(result.intent, 'UNKNOWN');
});

test('detectMeetingIntent es independiente de la intencion primaria', () => {
  assert.equal(detectMeetingIntent('Me gustaria agendar una reunion esta semana.'), true);
  assert.equal(detectMeetingIntent('Cuanto cuesta el plan? Tambien quisiera coordinar una llamada.'), true);
  assert.equal(detectMeetingIntent('Gracias por el mensaje.'), false);
});
