import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactText, redactValue, defaultSensitiveKeyNames } from './redaction.js';

test('redactText redacta un Bearer token embebido en texto libre', () => {
  const input = 'Request failed with Authorization: Bearer sometoken12345678901234567890 for user';
  const output = redactText(input);
  assert.ok(!output.includes('sometoken12345678901234567890'));
  assert.ok(output.includes('[REDACTED_SECRET]'));
});

test('redactText redacta claves AWS, OpenAI-style y JWT embebidas', () => {
  assert.equal(redactText('key=AKIAIOSFODNN7EXAMPLE listo'), 'key=[REDACTED_SECRET] listo');
  assert.ok(redactText('token sk-abcdefghijklmnopqrstuvwxyz123456 usado').includes('[REDACTED_SECRET]'));
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PYE';
  assert.ok(redactText(`auth=${jwt}`).includes('[REDACTED_SECRET]'));
});

test('redactText redacta emails y telefonos embebidos', () => {
  assert.equal(redactText('contacto: jane.doe@empresa.com'), 'contacto: [REDACTED_EMAIL]');
  assert.equal(redactText('llamar al +593 99 123 4567 hoy'), 'llamar al [REDACTED_PHONE] hoy');
});

test('redactText no toca texto sin secretos/PII', () => {
  assert.equal(redactText('Job completado en 3 pasos'), 'Job completado en 3 pasos');
});

test(
  '"Log snapshot" (Pruebas requeridas del packet) -- redactValue redacta un payload de log real completo por nombre de campo Y por contenido, preservando la forma del objeto',
  () => {
    const logPayload = {
      event: 'outreach.send.attempted',
      organizationId: 'org-123',
      contact: {
        fullName: 'Jane Doe',
        email: 'jane.doe@empresa.com',
        phone: '+593991234567',
      },
      credentialRef: 'vault:outreach:api-key',
      requestHeaders: {
        Authorization: 'Bearer sometoken12345678901234567890',
        cookie: 'session=abc123',
      },
      note: 'Fallo con token sk-abcdefghijklmnopqrstuvwxyz123456 en el cuerpo del error',
      tags: ['outreach', 'jane.doe@empresa.com'],
    };

    const redacted = redactValue(logPayload) as typeof logPayload & Record<string, unknown>;
    const serialized = JSON.stringify(redacted);

    // Ningun valor sensible real sobrevive, sea cual sea la ruta (nombre de campo o contenido).
    assert.ok(!serialized.includes('jane.doe@empresa.com'));
    assert.ok(!serialized.includes('+593991234567'));
    assert.ok(!serialized.includes('sometoken12345678901234567890'));
    assert.ok(!serialized.includes('sk-abcdefghijklmnopqrstuvwxyz123456'));
    assert.ok(!serialized.includes('abc123'));
    assert.ok(!serialized.includes('vault:outreach:api-key'), 'credentialRef se redacta SIEMPRE por nombre de campo, aunque sea una referencia real, no un secreto -- defensa en profundidad para logs');

    // La forma del objeto (claves, no-sensibles intactas) se preserva -- esto es lo que hace el snapshot util para depurar.
    assert.equal(redacted.event, 'outreach.send.attempted');
    assert.equal(redacted.organizationId, 'org-123');
    assert.equal((redacted.contact as Record<string, unknown>)['fullName'], 'Jane Doe');
    assert.equal((redacted.contact as Record<string, unknown>)['email'], '[REDACTED]');
    // "Authorization" es un nombre de campo sensible conocido -> capa 1 (nombre de campo) gana y
    // redacta en bloque ANTES de llegar a la capa 2 (patron de contenido); por eso es "[REDACTED]",
    // no "[REDACTED_SECRET]" -- ese segundo marcador es solo para secretos encontrados en campos
    // que no eran sensibles por nombre (ver el campo "note" mas abajo).
    assert.equal((redacted.requestHeaders as Record<string, unknown>)['Authorization'], '[REDACTED]');
    assert.equal(redacted.note.includes('[REDACTED_SECRET]'), true, 'el secreto embebido en "note" (campo no sensible por nombre) SI debe caer en la capa 2, por contenido');
    assert.ok(Array.isArray(redacted.tags));
  },
);

test('redactValue redacta dentro de arrays y respeta ciclos sin colgarse', () => {
  const withArray = redactValue(['plain', 'jane.doe@empresa.com']) as string[];
  assert.equal(withArray[0], 'plain');
  assert.equal(withArray[1], '[REDACTED_EMAIL]');

  const cyclic: Record<string, unknown> = { name: 'x' };
  cyclic['self'] = cyclic;
  const result = redactValue(cyclic) as Record<string, unknown>;
  assert.equal(result['self'], '[REDACTED_CIRCULAR]');
});

test('defaultSensitiveKeyNames incluye los campos criticos del proyecto', () => {
  for (const key of ['password', 'token', 'email', 'phone', 'credentialref']) {
    assert.ok(defaultSensitiveKeyNames.includes(key as (typeof defaultSensitiveKeyNames)[number]));
  }
});
