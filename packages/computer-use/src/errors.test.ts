import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStepError, isRetryableComputerUseCode } from './errors.js';

test('un timeout real (AbortError) se clasifica como RHIA_WORKFLOW_TIMEOUT y es retryable', () => {
  const error = classifyStepError(new DOMException('Aborted', 'AbortError'));
  assert.equal(error.code, 'RHIA_WORKFLOW_TIMEOUT');
  assert.equal(error.retryable, true);
});

test('un DOMException de AbortError nunca se confunde con un error ya clasificado por su .code numerico nativo', () => {
  const error = classifyStepError(new DOMException('Aborted', 'AbortError'));
  assert.notEqual(error.code, 20);
  assert.equal(typeof error.code, 'string');
});

test('una excepcion no clasificada se normaliza a RHIA_COMPUTER_USE_UNEXPECTED_FAILURE, mensaje truncado a 200 caracteres', () => {
  const error = classifyStepError(new Error('x'.repeat(500)));
  assert.equal(error.code, 'RHIA_COMPUTER_USE_UNEXPECTED_FAILURE');
  assert.equal(error.safeDetails.length, 200);
  assert.equal(error.retryable, false);
});

test('isRetryableComputerUseCode: solo RHIA_WORKFLOW_TIMEOUT es retryable', () => {
  assert.equal(isRetryableComputerUseCode('RHIA_WORKFLOW_TIMEOUT'), true);
  assert.equal(isRetryableComputerUseCode('RHIA_COMPUTER_USE_DOMAIN_FORBIDDEN'), false);
  assert.equal(isRetryableComputerUseCode('RHIA_COMPUTER_USE_APPROVAL_REQUIRED'), false);
});
