import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySourceReliability } from './source-reliability.js';

test('classifySourceReliability: dominio .gob/.gov domina sobre el sourceType declarado', () => {
  const score = classifySourceReliability({ domain: 'registro.gob.cr', sourceType: 'NEWS' });
  assert.equal(score, 0.95);
});

test('classifySourceReliability: directorio profesional conocido (linkedin) sube el piso de DIRECTORY', () => {
  const known = classifySourceReliability({ domain: 'linkedin.com', sourceType: 'DIRECTORY' });
  const generic = classifySourceReliability({ domain: 'directorio-desconocido.com', sourceType: 'DIRECTORY' });
  assert.ok(known > generic, `${known} debería ser mayor que ${generic}`);
});

test('classifySourceReliability: OFFICIAL_WEBSITE genérico usa el score base por sourceType', () => {
  assert.equal(classifySourceReliability({ domain: 'empresa-x.com', sourceType: 'OFFICIAL_WEBSITE' }), 0.85);
});

test('classifySourceReliability: siempre devuelve un valor en [0, 1]', () => {
  const score = classifySourceReliability({ domain: 'lo-que-sea.com', sourceType: 'UNKNOWN' });
  assert.ok(score >= 0 && score <= 1);
});
