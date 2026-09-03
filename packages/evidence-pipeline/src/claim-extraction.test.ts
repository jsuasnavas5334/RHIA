import assert from 'node:assert/strict';
import test from 'node:test';
import { extractClaims } from './claim-extraction.js';

test('extractClaims: detecta EMPLOYEE_COUNT en texto en inglés', () => {
  const claims = extractClaims('Empresa X has 150 employees across three offices.');
  assert.deepEqual(
    claims.find((claim) => claim.claimType === 'EMPLOYEE_COUNT')?.observedValue,
    { count: 150, unit: 'employees' },
  );
});

test('extractClaims: detecta FOUNDED_YEAR en texto en español', () => {
  const claims = extractClaims('Empresa X fue fundada en 1998 en San José.');
  assert.deepEqual(
    claims.find((claim) => claim.claimType === 'FOUNDED_YEAR')?.observedValue,
    { year: 1998 },
  );
});

test('extractClaims: detecta HEADQUARTERS_LOCATION', () => {
  const claims = extractClaims('Empresa X is headquartered in San Jose, Costa Rica.');
  const location = claims.find((claim) => claim.claimType === 'HEADQUARTERS_LOCATION');
  assert.ok(location, 'debería extraer HEADQUARTERS_LOCATION');
});

test('extractClaims: texto sin ningún patrón conocido no produce claims (no inventa)', () => {
  assert.deepEqual(extractClaims('Bienvenidos a nuestro sitio web, contáctenos para más información.'), []);
});

test('extractClaims: un mismo texto puede producir varios claims a la vez', () => {
  const claims = extractClaims('Empresa X, fundada en 2005, tiene 80 empleados.');
  const types = claims.map((claim) => claim.claimType).sort();
  assert.deepEqual(types, ['EMPLOYEE_COUNT', 'FOUNDED_YEAR']);
});
