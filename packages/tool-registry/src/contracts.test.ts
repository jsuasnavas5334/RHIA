import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateToolManifest, looksLikeRawSecret } from './contracts.js';

const validRaw = {
  id: 'tool-web-search',
  name: 'Web Search',
  ownerRef: 'team-search',
  riskLevel: 'MEDIUM',
  requiredCapability: 'records.read',
  credentialRef: 'vault:search-provider-key',
  allowedDomains: ['api.searchprovider.com'],
  allowedActions: ['search'],
};

test('validateToolManifest acepta un manifest real completo', () => {
  const result = validateToolManifest(validRaw);
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.manifest.id, 'tool-web-search');
});

test('Criterio "Cada tool tiene owner y risk" -- rechaza sin ownerRef o riskLevel invalido', () => {
  const withoutOwner = validateToolManifest({ ...validRaw, ownerRef: '' });
  assert.equal(withoutOwner.valid, false);
  if (!withoutOwner.valid) assert.ok(withoutOwner.errors.some((e) => e.field === 'ownerRef'));

  const badRisk = validateToolManifest({ ...validRaw, riskLevel: 'SUPER_HIGH' });
  assert.equal(badRisk.valid, false);
  if (!badRisk.valid) assert.ok(badRisk.errors.some((e) => e.field === 'riskLevel'));
});

test('Error a evitar "Tools sin policy" -- requiere una capability real de @rhia/policy y al menos una accion permitida', () => {
  const badCapability = validateToolManifest({ ...validRaw, requiredCapability: 'tools.anything' });
  assert.equal(badCapability.valid, false);
  if (!badCapability.valid) assert.ok(badCapability.errors.some((e) => e.field === 'requiredCapability'));

  const noActions = validateToolManifest({ ...validRaw, allowedActions: [] });
  assert.equal(noActions.valid, false);
  if (!noActions.valid) assert.ok(noActions.errors.some((e) => e.field === 'allowedActions'));
});

test('Error a evitar "Pasar credenciales en prompt" -- rechaza un credentialRef que parece una credencial real', () => {
  const withJwt = validateToolManifest({ ...validRaw, credentialRef: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PYE' });
  assert.equal(withJwt.valid, false);
  if (!withJwt.valid) assert.ok(withJwt.errors.some((e) => e.field === 'credentialRef'));

  const withBearer = validateToolManifest({ ...validRaw, credentialRef: 'Bearer sometoken12345678901234567890' });
  assert.equal(withBearer.valid, false);

  const withRealRef = validateToolManifest({ ...validRaw, credentialRef: 'vault:tool-x:api-key' });
  assert.equal(withRealRef.valid, true, 'una referencia corta y legible SI debe aceptarse');
});

test('looksLikeRawSecret distingue una referencia corta de un secreto real largo', () => {
  assert.equal(looksLikeRawSecret('vault:tool-x:api-key'), false);
  assert.equal(looksLikeRawSecret('AKIAIOSFODNN7EXAMPLE'), true);
  assert.equal(looksLikeRawSecret('sk-abcdefghijklmnopqrstuvwxyz123456'), true);
});

test('credentialRef null es valido (tool sin credencial)', () => {
  const result = validateToolManifest({ ...validRaw, credentialRef: null });
  assert.equal(result.valid, true);
});

// Gap real encontrado y documentado en docs/security/threat-model.md seccion 7
// (PH10-T003, "Data exfiltration"): antes, validateToolManifest solo aplicaba
// looksLikeRawSecret a credentialRef, nunca a ownerRef ni a name -- una
// credencial real pegada por error en cualquiera de esos 2 campos se
// registraba sin rechazo. Corregido este ciclo (fuera del Task Packet formal,
// como fix aislado y aditivo sobre el hallazgo ya documentado).
test('Gap corregido -- rechaza una credencial real pegada por error en ownerRef', () => {
  const withJwtOwner = validateToolManifest({
    ...validRaw,
    ownerRef: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PYE',
  });
  assert.equal(withJwtOwner.valid, false);
  if (!withJwtOwner.valid) assert.ok(withJwtOwner.errors.some((e) => e.field === 'ownerRef'));

  const withAwsKeyOwner = validateToolManifest({ ...validRaw, ownerRef: 'AKIAIOSFODNN7EXAMPLE' });
  assert.equal(withAwsKeyOwner.valid, false);
  if (!withAwsKeyOwner.valid) assert.ok(withAwsKeyOwner.errors.some((e) => e.field === 'ownerRef'));
});

test('Gap corregido -- rechaza una credencial real pegada por error en name', () => {
  const withBearerName = validateToolManifest({ ...validRaw, name: 'Bearer sometoken12345678901234567890' });
  assert.equal(withBearerName.valid, false);
  if (!withBearerName.valid) assert.ok(withBearerName.errors.some((e) => e.field === 'name'));
});

test('Gap corregido -- no introduce falsos positivos sobre owner/name humanos legitimos, incluso largos', () => {
  const legitOwnerLong = validateToolManifest({ ...validRaw, ownerRef: 'equipo-plataforma-de-agentes-digitales' });
  assert.equal(legitOwnerLong.valid, true, 'un ownerRef legible con guiones, aunque largo, NO debe rechazarse');

  const legitNameLong = validateToolManifest({ ...validRaw, name: 'Computer Use Adapter para Reservas de Reuniones' });
  assert.equal(legitNameLong.valid, true, 'un name legible con espacios, aunque largo, NO debe rechazarse');
});
