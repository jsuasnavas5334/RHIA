import assert from 'node:assert/strict';
import test from 'node:test';
import { appDestinations, navigationMode, pageStateCopy, visibleDestinations } from './navigation.js';

test('ADMIN ve todos los destinos y VIEWER solo lectura de registros', () => {
  assert.deepEqual(visibleDestinations(['ADMIN']), appDestinations);
  assert.deepEqual(visibleDestinations(['VIEWER']).map((item) => item.key), [
    'dashboard', 'companies', 'contacts', 'opportunities',
  ]);
});

test('sin roles no hay navegación y cada destino conserva key/href únicos', () => {
  assert.deepEqual(visibleDestinations([]), []);
  assert.equal(new Set(appDestinations.map((item) => item.key)).size, appDestinations.length);
  assert.equal(new Set(appDestinations.map((item) => item.href)).size, appDestinations.length);
});

test('OPERATOR no recibe settings ni controles comerciales de aprobación', () => {
  const keys = visibleDestinations(['OPERATOR']).map((item) => item.key);
  assert.equal(keys.includes('settings'), false);
  assert.equal(keys.includes('approvals'), true);
  assert.equal(keys.includes('agents'), true);
});

test('responsive y estados explican una acción siguiente', () => {
  assert.equal(navigationMode(767), 'DRAWER');
  assert.equal(navigationMode(768), 'SIDEBAR');
  assert.equal(Boolean(pageStateCopy.EMPTY.action), true);
  assert.equal(Boolean(pageStateCopy.ERROR.action), true);
});
