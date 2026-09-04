import assert from 'node:assert/strict';
import test from 'node:test';
import { matchByLegalIdentifier, matchByNameAndLocation } from './entity-matcher.js';
import type { KnownEntity, LocationResolution } from './schema.js';

const RESOLVED_US: LocationResolution = { status: 'RESOLVED', city: 'Springfield', countryCode: 'US', confidence: 0.8 };
const RESOLVED_CR: LocationResolution = { status: 'RESOLVED', city: 'San José', countryCode: 'CR', confidence: 0.8 };
const NONE: LocationResolution = { status: 'NONE', confidence: 0 };

const known = (overrides: Partial<KnownEntity> & { companyGroupId: string; canonicalName: string }): KnownEntity => ({
  legalIdentifiers: [],
  aliases: [],
  ...overrides,
});

test('matchByLegalIdentifier: identificador y país coinciden -> match', () => {
  const acme = known({ companyGroupId: 'g-1', canonicalName: 'Acme Corp', legalIdentifiers: ['12-3456789'], countryCode: 'US' });
  const result = matchByLegalIdentifier([{ identifier: '123456789', countryCode: 'US', confidence: 0.9 }], [acme]);
  assert.equal(result?.known.companyGroupId, 'g-1');
});

test('matchByLegalIdentifier: mismo número pero país distinto -> sin match', () => {
  const acme = known({ companyGroupId: 'g-1', canonicalName: 'Acme Corp', legalIdentifiers: ['123456789'], countryCode: 'US' });
  const result = matchByLegalIdentifier([{ identifier: '123456789', countryCode: 'CR', confidence: 0.9 }], [acme]);
  assert.equal(result, undefined);
});

test('matchByNameAndLocation: mismo nombre, país compatible -> match', () => {
  const acmeUs = known({ companyGroupId: 'g-1', canonicalName: 'Acme Corp', countryCode: 'US' });
  const result = matchByNameAndLocation([{ name: 'Acme Corp', kind: 'LEGAL', confidence: 0.8 }], [acmeUs], RESOLVED_US);
  assert.equal(result?.known.companyGroupId, 'g-1');
});

test('matchByNameAndLocation: mismo nombre, país en conflicto -> descartado de plano (no mezcla San José CR/US)', () => {
  const acmeUs = known({ companyGroupId: 'g-1', canonicalName: 'Acme Corp', countryCode: 'US' });
  const result = matchByNameAndLocation([{ name: 'Acme Corp', kind: 'LEGAL', confidence: 0.8 }], [acmeUs], RESOLVED_CR);
  assert.equal(result, undefined, 'un conflicto de país explícito descalifica el candidato aunque el nombre sea idéntico');
});

test('matchByNameAndLocation: sin ubicación resuelta, el nombre por sí solo puede matchear (señal débil pero no bloqueada)', () => {
  const acmeUs = known({ companyGroupId: 'g-1', canonicalName: 'Acme Corp', countryCode: 'US' });
  const result = matchByNameAndLocation([{ name: 'Acme Corp', kind: 'LEGAL', confidence: 0.8 }], [acmeUs], NONE);
  assert.equal(result?.known.companyGroupId, 'g-1');
});

test('matchByNameAndLocation: nombre sin similitud suficiente no matchea', () => {
  const globex = known({ companyGroupId: 'g-2', canonicalName: 'Globex Industries' });
  const result = matchByNameAndLocation([{ name: 'Acme Corp', kind: 'LEGAL', confidence: 0.8 }], [globex], NONE);
  assert.equal(result, undefined);
});
