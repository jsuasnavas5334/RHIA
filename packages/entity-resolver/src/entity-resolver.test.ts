// PH06-T004 — pruebas del orquestador `resolveCompanyEntity`. Incluye las
// 3 pruebas requeridas por el Task Packet ("Ambiguous city", "Same name
// different company", "Subsidiary test") y los 3 criterios de aceptación
// ("No mezcla San José CR/US/Belize", "Multinacional conserva grupo
// común", "Confidence bajo no auto-confirma").

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCompanyEntity } from './entity-resolver.js';
import type { EntityResolutionInput, KnownEntity } from './schema.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const GROUP_US_ACME = 'a0000000-0000-4000-8000-00000000000a';
const GROUP_HOLDING = 'b0000000-0000-4000-8000-00000000000b';
const GROUP_MULTI = 'c0000000-0000-4000-8000-00000000000c';
const GROUP_KNOWN = 'd0000000-0000-4000-8000-00000000000d';

const knownEntity = (overrides: Partial<KnownEntity> & { companyGroupId: string; canonicalName: string }): KnownEntity => ({
  legalIdentifiers: [],
  aliases: [],
  ...overrides,
});

const baseInput = (overrides: Partial<EntityResolutionInput> = {}): EntityResolutionInput => ({
  organizationId: ORG_ID,
  names: [{ name: 'Acme Corp', kind: 'LEGAL', confidence: 0.8 }],
  legalIdentifiers: [],
  locations: [],
  ownership: [],
  knownEntities: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Prueba requerida 1: Ambiguous city.
// ---------------------------------------------------------------------------

test('Ambiguous city: candidato en "San José" sin señal de país confiable escala a revisión, sin forzar un país', () => {
  const input = baseInput({ locations: [{ city: 'San José', confidence: 0.6 }] });

  const result = resolveCompanyEntity(input);

  assert.equal(result.location.status, 'AMBIGUOUS');
  assert.equal(result.location.countryCode, undefined);
  assert.equal(result.status, 'NEEDS_REVIEW', 'ubicación ambigua nunca debe auto-confirmarse');
  assert.ok(result.conflicts.some((conflict) => conflict.includes('ubicación ambigua')));
});

test('Ambiguous city: señales de país en conflicto directo (CR vs US) para "San José" también escala, nunca elige uno', () => {
  const input = baseInput({
    locations: [
      { city: 'San José', countryCode: 'CR', confidence: 0.6 },
      { city: 'San José', countryCode: 'US', confidence: 0.6 },
    ],
  });

  const result = resolveCompanyEntity(input);

  assert.equal(result.location.status, 'AMBIGUOUS');
  assert.equal(result.status, 'NEEDS_REVIEW');
});

// ---------------------------------------------------------------------------
// Prueba requerida 2: Same name different company.
// ---------------------------------------------------------------------------

test('Same name different company: mismo nombre exacto, países distintos, sin legal identifier ni ownership -> NO se fusiona', () => {
  const existingAcmeUs = knownEntity({
    companyGroupId: GROUP_US_ACME,
    canonicalName: 'Acme Corp',
    legalIdentifiers: ['12-3456789'],
    countryCode: 'US',
  });

  const input = baseInput({
    names: [{ name: 'Acme Corp', kind: 'LEGAL', confidence: 0.8 }],
    locations: [{ city: 'San José', countryCode: 'CR', confidence: 0.8 }],
    knownEntities: [existingAcmeUs],
  });

  const result = resolveCompanyEntity(input);

  assert.equal(result.isNewGroup, true, 'sin legal identifier ni ownership que los ligue, dos "Acme Corp" en países distintos son entidades distintas');
  assert.notEqual(result.matchedGroupId, GROUP_US_ACME);
});

// ---------------------------------------------------------------------------
// Prueba requerida 3: Subsidiary test.
// ---------------------------------------------------------------------------

test('Subsidiary test: señal de ownership liga la subsidiaria al grupo de la matriz conocida', () => {
  const parentHolding = knownEntity({ companyGroupId: GROUP_HOLDING, canonicalName: 'Acme Holding', countryCode: 'US' });

  const input = baseInput({
    names: [{ name: 'Acme Panama SA', kind: 'LEGAL', confidence: 0.7 }],
    locations: [{ city: 'Panama City', countryCode: 'PA', confidence: 0.7 }],
    ownership: [{ counterpartName: 'Acme Holding', relation: 'SUBSIDIARY_OF', confidence: 0.85 }],
    knownEntities: [parentHolding],
  });

  const result = resolveCompanyEntity(input);

  assert.equal(result.relationship?.relation, 'SUBSIDIARY_OF');
  assert.equal(result.matchedGroupId, GROUP_HOLDING, 'la subsidiaria debe quedar bajo el mismo grupo que su matriz conocida');
  assert.equal(result.isNewGroup, false);
});

// ---------------------------------------------------------------------------
// Criterio de aceptación: Multinacional conserva grupo común.
// ---------------------------------------------------------------------------

test('Multinacional conserva grupo común: dos entidades del mismo grupo en países distintos, ligadas por ownership, comparten companyGroupId', () => {
  const groupParent = knownEntity({ companyGroupId: GROUP_MULTI, canonicalName: 'Globex Group', countryCode: 'US' });

  const subsidiaryOne = resolveCompanyEntity(
    baseInput({
      names: [{ name: 'Globex Mexico', kind: 'LEGAL', confidence: 0.7 }],
      locations: [{ city: 'Ciudad de Mexico', countryCode: 'MX', confidence: 0.7 }],
      ownership: [{ counterpartName: 'Globex Group', relation: 'SUBSIDIARY_OF', confidence: 0.8 }],
      knownEntities: [groupParent],
    }),
  );

  const subsidiaryTwo = resolveCompanyEntity(
    baseInput({
      names: [{ name: 'Globex Peru', kind: 'LEGAL', confidence: 0.7 }],
      locations: [{ city: 'Lima', countryCode: 'PE', confidence: 0.7 }],
      ownership: [{ counterpartName: 'Globex Group', relation: 'SUBSIDIARY_OF', confidence: 0.8 }],
      knownEntities: [groupParent],
    }),
  );

  assert.equal(subsidiaryOne.matchedGroupId, GROUP_MULTI);
  assert.equal(subsidiaryTwo.matchedGroupId, GROUP_MULTI);
  assert.equal(subsidiaryOne.matchedGroupId, subsidiaryTwo.matchedGroupId, 'ambas subsidiarias deben conservar el mismo grupo que su matriz, aunque estén en países distintos');
});

// ---------------------------------------------------------------------------
// Criterio de aceptación: Confidence bajo no auto-confirma.
// ---------------------------------------------------------------------------

test('Confidence bajo no auto-confirma: señales débiles y sin match producen NEEDS_REVIEW, no RESOLVED', () => {
  const input = baseInput({
    names: [{ name: 'Unverified Startup', kind: 'ALIAS', confidence: 0.2 }],
    locations: [],
  });

  const result = resolveCompanyEntity(input);

  assert.ok(result.confidence < 0.55);
  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.ok(result.conflicts.length > 0, 'debe quedar un motivo explícito registrado, no una confianza baja silenciosa');
});

test('legal identifier match es concluyente incluso si la ubicación es NONE: RESOLVED con alta confianza', () => {
  const existing = knownEntity({
    companyGroupId: GROUP_KNOWN,
    canonicalName: 'Acme Corp',
    legalIdentifiers: ['12-3456789'],
    countryCode: 'US',
  });

  const input = baseInput({
    names: [{ name: 'Acme Corp', kind: 'LEGAL', confidence: 0.8 }],
    legalIdentifiers: [{ identifier: '123456789', countryCode: 'US', confidence: 0.95 }],
    knownEntities: [existing],
  });

  const result = resolveCompanyEntity(input);

  assert.equal(result.matchedGroupId, GROUP_KNOWN);
  assert.equal(result.isNewGroup, false);
  assert.equal(result.status, 'RESOLVED');
});
