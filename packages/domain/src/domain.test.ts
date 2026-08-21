import assert from 'node:assert/strict';
import test from 'node:test';
import { assertTransition, canTransition, errorCatalog, errorCodes, isTerminalState, stateMachines } from './index.js';

test('cada máquina cubre todos sus estados y terminales no tienen salida', () => {
  for (const [name, machine] of Object.entries(stateMachines)) {
    assert.deepEqual(Object.keys(machine.transitions).sort(), [...machine.states].sort(), name);
    for (const terminal of machine.terminal) {
      assert.deepEqual((machine.transitions as Readonly<Record<string, readonly string[]>>)[terminal], [], `${name}.${terminal}`);
    }
  }
});

test('transiciones válidas aprueban e inválidas fallan', () => {
  assert.equal(canTransition('job', 'PENDING', 'QUEUED'), true);
  assert.equal(canTransition('evidence', 'ACTIVE', 'STALE'), true);
  assert.equal(canTransition('opportunity', 'ENGAGED', 'MEETING_BOOKED'), true);
  assert.equal(canTransition('message', 'APPROVED', 'PLANNED'), true);
  assert.equal(canTransition('message', 'SENT', 'REPLIED'), true);
  assert.equal(canTransition('meeting', 'CONFIRMED', 'ATTENDED'), true);
  assert.throws(() => assertTransition('job', 'SUCCEEDED', 'RUNNING'), { name: 'InvalidStateTransitionError' });
  assert.equal(canTransition('message', 'OPTED_OUT', 'SENDING'), false);
});

test('terminal states coinciden con máquinas', () => {
  assert.equal(isTerminalState('job', 'DEAD_LETTER'), true);
  assert.equal(isTerminalState('evidence', 'STALE'), false);
  assert.equal(isTerminalState('opportunity', 'WON'), true);
  assert.equal(isTerminalState('meeting', 'RESCHEDULED'), true);
});

test('catálogo de errores es completo y clasificación es explícita', () => {
  assert.deepEqual(Object.keys(errorCatalog).sort(), [...errorCodes].sort());
  for (const definition of Object.values(errorCatalog)) {
    assert.equal(typeof definition.retryable, 'boolean');
    assert.equal(typeof definition.terminal, 'boolean');
    assert.ok(definition.description.length > 0);
  }
});

test('degradación de búsqueda tiene código propio y retry seguro', () => {
  assert.equal(errorCatalog.RHIA_SEARCH_PROVIDER_DEGRADED.category, 'DEPENDENCY');
  assert.equal(errorCatalog.RHIA_SEARCH_PROVIDER_DEGRADED.retryable, true);
  assert.equal(errorCatalog.RHIA_SEARCH_PROVIDER_DEGRADED.terminal, false);
  assert.equal(errorCatalog.RHIA_ENTITY_AMBIGUOUS.retryable, false);
  assert.equal(errorCatalog.RHIA_APPROVAL_REQUIRED.retryable, false);
  assert.equal(errorCatalog.RHIA_CORE_UNEXPECTED_FAILURE.retryable, false);
});
