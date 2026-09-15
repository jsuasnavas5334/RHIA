// "Secret scan" -- Pruebas requeridas del packet PH10-T001. El scan REAL a
// nivel de repositorio ya existe y es real (`scripts/verify-repository-baseline.ps1`,
// firmas AWS/GitHub/Slack/OpenAI/private-key sobre archivos publicables +
// rutas ignoradas de git) -- ver docs/progress/PH10-T001.md "Reutilizado,
// no reimplementado" para la decision explicita de no duplicarlo. Esta
// prueba cubre la MISMA familia de firmas (secretos reales pegados por
// accidente) contra las 2 defensas nuevas de este paquete que SI corren
// dentro del proceso (no solo en CI de repositorio): `looksLikeRawSecret`
// (reusada de @rhia/tool-registry, aplicada aqui a `SecretReference.ref`) y
// `redactText` (aplicada a logs). Un secreto real de cualquiera de estas
// formas nunca debe sobrevivir sin marcar/redactar en ninguna de las 2 rutas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeRawSecret } from '@rhia/tool-registry';
import { redactText } from './redaction.js';
import { validateSecretReference } from './contracts.js';

const realisticSecretSamples: readonly string[] = [
  'AKIAIOSFODNN7EXAMPLE', // AWS access key id
  'sk-abcdefghijklmnopqrstuvwxyz123456', // OpenAI-style key
  'Bearer sometoken12345678901234567890', // bearer token
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PYE', // JWT-like
];

test('Secret scan -- looksLikeRawSecret marca las 4 familias de secretos reales del proyecto', () => {
  for (const sample of realisticSecretSamples) {
    assert.equal(looksLikeRawSecret(sample), true, `deberia marcarse como secreto real: ${sample.slice(0, 12)}...`);
  }
});

test('Secret scan -- una referencia de vault real (no un secreto) nunca se marca (evita falsos positivos que romperian el flujo normal)', () => {
  const realReferences = ['vault:outreach:api-key', 'env:OPENAI_API_KEY', 'vault:crm:contact-point-key-v1'];
  for (const ref of realReferences) {
    assert.equal(looksLikeRawSecret(ref), false, `no deberia marcarse: ${ref}`);
  }
});

test('Secret scan -- validateSecretReference rechaza CADA muestra realista si se pega por accidente en `ref`', () => {
  for (const sample of realisticSecretSamples) {
    const result = validateSecretReference({
      name: 'x',
      ref: sample,
      rotationIntervalDays: 30,
      lastRotatedAt: null,
    });
    assert.equal(result.valid, false, `debería rechazarse: ${sample.slice(0, 12)}...`);
  }
});

test('Secret scan -- redactText elimina CADA muestra realista si aparece embebida en un log/mensaje de error', () => {
  for (const sample of realisticSecretSamples) {
    const logLine = `[ERROR] llamada externa fallo, header enviado: ${sample}`;
    const redacted = redactText(logLine);
    assert.ok(!redacted.includes(sample), `no deberia sobrevivir en el log: ${sample.slice(0, 12)}...`);
    assert.ok(redacted.includes('[REDACTED_SECRET]'));
  }
});
