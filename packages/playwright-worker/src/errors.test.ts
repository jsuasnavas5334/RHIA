import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserSelectorNotFoundError, BrowserSessionExpiredError, classifyStepError, isRetryableBrowserCode } from './errors.js';

test('un timeout real (AbortError) se clasifica como RHIA_WORKFLOW_TIMEOUT y es retryable', () => {
  const error = classifyStepError(new DOMException('Aborted', 'AbortError'));
  assert.equal(error.code, 'RHIA_WORKFLOW_TIMEOUT');
  assert.equal(error.retryable, true);
});

// Prueba requerida "UI changed".
test('BrowserSelectorNotFoundError se clasifica como RHIA_BROWSER_SELECTOR_NOT_FOUND y NO es retryable', () => {
  const error = classifyStepError(new BrowserSelectorNotFoundError());
  assert.equal(error.code, 'RHIA_BROWSER_SELECTOR_NOT_FOUND');
  assert.equal(error.retryable, false);
});

// Prueba requerida "Login expired".
test('BrowserSessionExpiredError se clasifica como RHIA_BROWSER_SESSION_EXPIRED y NO es retryable', () => {
  const error = classifyStepError(new BrowserSessionExpiredError());
  assert.equal(error.code, 'RHIA_BROWSER_SESSION_EXPIRED');
  assert.equal(error.retryable, false);
});

test('una excepcion no clasificada se normaliza a RHIA_BROWSER_UNEXPECTED_FAILURE, mensaje truncado a 200 caracteres', () => {
  const longMessage = 'x'.repeat(500);
  const error = classifyStepError(new Error(longMessage));
  assert.equal(error.code, 'RHIA_BROWSER_UNEXPECTED_FAILURE');
  assert.equal(error.safeDetails.length, 200);
  assert.equal(error.retryable, false);
});

test('un valor lanzado que no es Error real tambien se normaliza sin lanzar', () => {
  const error = classifyStepError('algo-no-error');
  assert.equal(error.code, 'RHIA_BROWSER_UNEXPECTED_FAILURE');
});

test('isRetryableBrowserCode: solo RHIA_WORKFLOW_TIMEOUT es retryable', () => {
  assert.equal(isRetryableBrowserCode('RHIA_WORKFLOW_TIMEOUT'), true);
  assert.equal(isRetryableBrowserCode('RHIA_BROWSER_SELECTOR_NOT_FOUND'), false);
  assert.equal(isRetryableBrowserCode('RHIA_BROWSER_SESSION_EXPIRED'), false);
  assert.equal(isRetryableBrowserCode('RHIA_BROWSER_DOMAIN_FORBIDDEN'), false);
});
