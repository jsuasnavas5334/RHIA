import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLocation } from './location-resolver.js';
import type { LocationSignal } from './schema.js';

const signal = (overrides: Partial<LocationSignal> & { city: string; confidence: number }): LocationSignal => overrides;

test('sin señales de ubicación: status NONE', () => {
  const result = resolveLocation([]);
  assert.equal(result.status, 'NONE');
});

test('ciudad ambigua conocida ("San José") sin señal de país: AMBIGUOUS, nunca se fuerza un país (criterio de aceptación)', () => {
  const result = resolveLocation([signal({ city: 'San José', confidence: 0.7 })]);
  assert.equal(result.status, 'AMBIGUOUS');
  assert.equal(result.countryCode, undefined, 'no debe asignar ningún país por defecto');
});

test('ciudad ambigua ("San José") con señales de país en conflicto (CR vs US): AMBIGUOUS, no mezcla los países', () => {
  const result = resolveLocation([
    signal({ city: 'San José', countryCode: 'CR', confidence: 0.6 }),
    signal({ city: 'San José', countryCode: 'US', confidence: 0.6 }),
  ]);
  assert.equal(result.status, 'AMBIGUOUS');
  assert.ok(result.reason?.includes('CR'));
  assert.ok(result.reason?.includes('US'));
});

test('ciudad ambigua ("San José") con una única señal de país confiable: RESOLVED a ese país', () => {
  const result = resolveLocation([signal({ city: 'San José', countryCode: 'CR', confidence: 0.8 })]);
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.countryCode, 'CR');
});

test('San José CR + San José Belize + San José US como señales separadas y en conflicto: nunca colapsan en un solo país', () => {
  const result = resolveLocation([
    signal({ city: 'San José', countryCode: 'CR', confidence: 0.5 }),
    signal({ city: 'San José', countryCode: 'BZ', confidence: 0.5 }),
    signal({ city: 'San José', countryCode: 'US', confidence: 0.5 }),
  ]);
  assert.equal(result.status, 'AMBIGUOUS');
});

test('ciudad NO ambigua con señal de país: RESOLVED con confianza', () => {
  const result = resolveLocation([signal({ city: 'Guayaquil', countryCode: 'EC', confidence: 0.9 })]);
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.countryCode, 'EC');
  assert.equal(result.city, 'Guayaquil');
});

test('varias señales de la misma ciudad y país suben la confianza combinada', () => {
  const single = resolveLocation([signal({ city: 'Quito', countryCode: 'EC', confidence: 0.5 })]);
  const double = resolveLocation([
    signal({ city: 'Quito', countryCode: 'EC', confidence: 0.5 }),
    signal({ city: 'Quito', countryCode: 'EC', confidence: 0.5 }),
  ]);
  assert.equal(single.confidence, 0.5);
  assert.equal(double.confidence, 0.5); // promedio, no noisy-or -- ver comentario del módulo (v1 simple)
  assert.equal(double.status, 'RESOLVED');
});
