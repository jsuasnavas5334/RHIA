import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveTargetRoles, matchRoleAreaForTitle } from './role-derivation.js';

// Prueba requerida del packet: "Cross-role tests" -- distintos casos de uso
// deben priorizar distintas areas, nunca siempre la misma.
test('cross-role: un caso de uso de nomina prioriza RRHH sobre operaciones', () => {
  const roles = deriveTargetRoles({ description: 'Software de nomina y gestion de talento humano para empresas medianas.' });
  assert.equal(roles[0]?.area, 'RRHH');
  assert.ok((roles[0]?.priority ?? 0) > (roles.find((r) => r.area === 'OPERACIONES')?.priority ?? 1));
});

test('cross-role: un caso de uso de manufactura prioriza operaciones, no RRHH (error a evitar: asumir que todo buyer es RRHH)', () => {
  const roles = deriveTargetRoles({ description: 'Sistema de gestion de planta, produccion y cadena de suministro para manufactura.' });
  assert.equal(roles[0]?.area, 'OPERACIONES');
  const hr = roles.find((r) => r.area === 'RRHH');
  assert.ok(hr !== undefined);
  assert.ok((hr?.priority ?? 1) < (roles[0]?.priority ?? 0));
});

test('cross-role: un caso de uso de BI ejecutivo prioriza gerencia', () => {
  const roles = deriveTargetRoles({ description: 'Panel de estrategia y gobierno corporativo para la junta directiva y direccion general.' });
  assert.equal(roles[0]?.area, 'GERENCIA');
});

test('cross-role: sin ninguna senal de contexto, ninguna area especifica gana -- OTRA queda con el piso minimo, no RRHH por defecto', () => {
  const roles = deriveTargetRoles({ description: 'Necesitamos mejorar algo en la empresa.' });
  const rrhh = roles.find((r) => r.area === 'RRHH');
  assert.equal(rrhh?.priority, 0);
  assert.equal(rrhh?.matchedContextTerms.length, 0);
});

// "Lista rigida global de cargos": areas distintas deben tener listas de
// cargos (titleKeywords) DISTINTAS -- si fueran la misma lista global, esto
// fallaria.
test('no hay una lista rigida global de cargos: cada area expone su propia lista de titleKeywords', () => {
  const roles = deriveTargetRoles({ description: 'texto neutro sin senales' });
  const hrTitles = new Set(roles.find((r) => r.area === 'RRHH')?.titleKeywords);
  const opsTitles = new Set(roles.find((r) => r.area === 'OPERACIONES')?.titleKeywords);
  const overlap = [...hrTitles].filter((title) => opsTitles.has(title));
  assert.equal(overlap.length, 0);
});

test('deriveTargetRoles siempre devuelve las 7 areas (nunca colapsa a una sola ganadora)', () => {
  const roles = deriveTargetRoles({ description: 'nomina y recursos humanos' });
  assert.equal(roles.length, 7);
});

test('matchRoleAreaForTitle: un cargo de RRHH clasifica en RRHH aunque el caso de uso este orientado a operaciones', () => {
  const roles = deriveTargetRoles({ description: 'logistica y manufactura' });
  const area = matchRoleAreaForTitle('Gerente de Talento Humano', roles);
  assert.equal(area, 'RRHH');
});

test('matchRoleAreaForTitle: titulo nulo (identidad no resuelta) da OTRA, nunca adivina', () => {
  const roles = deriveTargetRoles({ description: 'nomina' });
  assert.equal(matchRoleAreaForTitle(null, roles), 'OTRA');
});

test('matchRoleAreaForTitle: cargo sin ninguna coincidencia de keyword cae al area de mayor prioridad del caso de uso', () => {
  const roles = deriveTargetRoles({ description: 'nomina y recursos humanos para toda la empresa' });
  const area = matchRoleAreaForTitle('Especialista en algo muy raro sin match', roles);
  assert.equal(area, roles[0]?.area);
});
