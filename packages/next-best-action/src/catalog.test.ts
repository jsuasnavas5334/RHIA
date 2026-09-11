import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NBA_ACTIONS, isCatalogAction, actionRequiresApproval } from './catalog.js';

test('catalog: contiene exactamente los 5 verbos del Objetivo del packet', () => {
  assert.deepEqual([...NBA_ACTIONS].sort(), ['CONTACT', 'DISCARD', 'REVALIDATE', 'RESEARCH', 'WAIT'].sort());
});

test('catalog: isCatalogAction acepta solo valores del catalogo', () => {
  for (const action of NBA_ACTIONS) assert.equal(isCatalogAction(action), true);
  assert.equal(isCatalogAction('SEND_GIFT'), false);
  assert.equal(isCatalogAction('contact'), false); // case-sensitive, sin normalizacion magica
  assert.equal(isCatalogAction(null), false);
  assert.equal(isCatalogAction(undefined), false);
  assert.equal(isCatalogAction(42), false);
  assert.equal(isCatalogAction({ action: 'CONTACT' }), false);
});

test('catalog: solo DISCARD exige aprobacion (accion sensible, irreversible)', () => {
  for (const action of NBA_ACTIONS) {
    assert.equal(actionRequiresApproval(action), action === 'DISCARD', `accion ${action}`);
  }
});
