import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogEntry, createLogger } from './logging.js';

// Error a evitar del packet "Logs sin correlation ID".
test('createLogEntry rechaza una entrada sin traceId', () => {
  const result = createLogEntry({ level: 'info', component: 'agent-runtime.worker', message: 'job iniciado', traceId: '' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'RHIA_OBS_MISSING_TRACE_ID');
});

test('createLogEntry rechaza una entrada sin component', () => {
  const result = createLogEntry({ level: 'info', component: '', message: 'x', traceId: 'trace-1' });
  assert.equal(result.ok, false);
});

// Error a evitar del packet "Datos sensibles" -- log snapshot real: un
// evento de log completo (mismo espiritu de prueba que
// `@rhia/secrets#redaction.test.ts`) con secretos/PII embebidos en el
// mensaje y campos sensibles por nombre en `fields`.
test('createLogEntry redacta secretos y PII por contenido y por nombre de campo', () => {
  const result = createLogEntry({
    level: 'error',
    component: 'ai-gateway.openai',
    message: 'Fallo de auth con token sk-abcdefghijklmnopqrstuvwxyz123456 contactar a ops@rhia.dev',
    traceId: 'trace-real-1',
    fields: {
      password: 'hunter2',
      requestHeaders: { Authorization: 'Bearer sometoken1234567890' },
      note: 'reintentar en 5 minutos',
      email: 'contacto@empresa.com',
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.entry.message.includes('sk-abcdefghijklmnopqrstuvwxyz123456'), false);
  assert.match(result.entry.message, /\[REDACTED_SECRET\]/);
  assert.equal(result.entry.message.includes('ops@rhia.dev'), false);
  assert.match(result.entry.message, /\[REDACTED_EMAIL\]/);

  assert.equal(result.entry.fields['password'], '[REDACTED]');
  assert.deepEqual(result.entry.fields['requestHeaders'], { Authorization: '[REDACTED]' });
  assert.equal(result.entry.fields['note'], 'reintentar en 5 minutos'); // no sensible, sobrevive intacto
  assert.equal(result.entry.fields['email'], '[REDACTED]'); // sensible por nombre de campo

  assert.equal(result.entry.traceId, 'trace-real-1');
  assert.equal(result.entry.component, 'ai-gateway.openai');
  assert.ok(result.entry.occurredAt);
});

test('createLogger produce entradas atadas a un component fijo, pero sigue exigiendo traceId por llamada', () => {
  const logger = createLogger('tool-registry.playwright');

  const missingTrace = logger.log('warn', 'reintento de tool');
  assert.equal(missingTrace.ok, false);

  const withTrace = logger.log('warn', 'reintento de tool', { traceId: 'trace-2', spanId: 'span-1', fields: { attempt: 2 } });
  assert.equal(withTrace.ok, true);
  if (withTrace.ok) {
    assert.equal(withTrace.entry.component, 'tool-registry.playwright');
    assert.equal(withTrace.entry.traceId, 'trace-2');
    assert.equal(withTrace.entry.spanId, 'span-1');
    assert.equal(withTrace.entry.fields['attempt'], 2);
  }
});
