import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_COUNTRY_PRIORITY, countryPriority, geoPriority } from './geo-priority.js';

test('countryPriority: Ecuador tiene la prioridad mas alta por defecto', () => {
  assert.equal(countryPriority('EC'), 1);
});

test('countryPriority: Peru tiene prioridad alta pero menor que Ecuador', () => {
  const pe = countryPriority('PE');
  const ec = countryPriority('EC');
  assert.ok(pe > 0 && pe < ec);
});

// Criterio de aceptacion: "Otros paises siguen elegibles".
test('countryPriority: un pais no listado nunca es 0 -- sigue siendo elegible', () => {
  const priority = countryPriority('DE');
  assert.ok(priority > 0);
  assert.equal(priority, DEFAULT_COUNTRY_PRIORITY);
});

test('countryPriority: es insensible a mayusculas/minusculas', () => {
  assert.equal(countryPriority('ec'), countryPriority('EC'));
});

test('countryPriority: la tabla es configurable -- un llamador puede repriorizar sin tocar el motor', () => {
  const customTable = { EC: 0.3, PE: 1 };
  assert.equal(countryPriority('PE', customTable), 1);
  assert.equal(countryPriority('EC', customTable), 0.3);
});

test('geoPriority: sin ciudad, cae a la prioridad del pais', () => {
  assert.equal(geoPriority('EC', null), countryPriority('EC'));
});

test('geoPriority: con tabla de ciudad y match, usa la prioridad de ciudad', () => {
  const cityTable = { EC: { quito: 1, guayaquil: 0.9 } };
  assert.equal(geoPriority('EC', 'Quito', undefined, cityTable), 1);
});

test('geoPriority: con tabla de ciudad pero SIN match, cae a la prioridad del pais (no penaliza por falta de dato de ciudad)', () => {
  const cityTable = { EC: { quito: 1 } };
  assert.equal(geoPriority('EC', 'Cuenca', undefined, cityTable), countryPriority('EC'));
});
