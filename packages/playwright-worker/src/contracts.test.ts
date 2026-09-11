import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRobustSelector, isSafelyRetryableAction, validateScenario } from './contracts.js';

const baseScenario = () => ({
  id: 'scn-1',
  allowedDomains: ['app.example.com'],
  defaultTimeoutMs: 5000,
  steps: [
    { id: 'step-1', action: { kind: 'NAVIGATE', url: 'https://app.example.com/login' } },
  ],
});

test('escenario minimo real valido es aceptado', () => {
  const result = validateScenario(baseScenario());
  assert.equal(result.valid, true);
});

test('id de escenario vacio es rechazado', () => {
  const result = validateScenario({ ...baseScenario(), id: '' });
  assert.equal(result.valid, false);
});

// Accion "Domain allowlist".
test('allowedDomains vacio se rechaza -- fail-closed, nunca implicito', () => {
  const result = validateScenario({ ...baseScenario(), allowedDomains: [] });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.field === 'allowedDomains'));
});

test('un NAVIGATE hacia un host fuera de allowedDomains SI pasa la validacion estructural -- el chequeo real de la allowlist es responsabilidad exclusiva del runtime (ver worker.test.ts, assertDomainAllowed)', () => {
  const scenario = { ...baseScenario(), steps: [{ id: 'step-1', action: { kind: 'NAVIGATE', url: 'https://evil.example.com/' } }] };
  assert.equal(validateScenario(scenario).valid, true);
});

test('una url de NAVIGATE mal formada (no absoluta) si se rechaza en validacion estructural', () => {
  const scenario = { ...baseScenario(), steps: [{ id: 'step-1', action: { kind: 'NAVIGATE', url: 'no-es-una-url' } }] };
  const result = validateScenario(scenario);
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.field.includes('url')));
});

test('steps vacio se rechaza', () => {
  const result = validateScenario({ ...baseScenario(), steps: [] });
  assert.equal(result.valid, false);
});

test('ids de step duplicados se rechazan -- checkpoints reales necesitan ids unicos', () => {
  const scenario = {
    ...baseScenario(),
    steps: [
      { id: 'dup', action: { kind: 'NAVIGATE', url: 'https://app.example.com/a' } },
      { id: 'dup', action: { kind: 'NAVIGATE', url: 'https://app.example.com/b' } },
    ],
  };
  const result = validateScenario(scenario);
  assert.equal(result.valid, false);
});

// Error a evitar "Selectors fragiles por texto unicamente".
test('isRobustSelector rechaza una cadena que SOLO tiene estrategia text', () => {
  assert.equal(isRobustSelector({ strategies: [{ kind: 'text', value: 'Enviar' }] }), false);
});

test('isRobustSelector acepta text como fallback ADICIONAL junto a una estrategia estructural', () => {
  assert.equal(
    isRobustSelector({ strategies: [{ kind: 'testId', value: 'submit-button' }, { kind: 'text', value: 'Enviar' }] }),
    true,
  );
});

test('isRobustSelector rechaza un array vacio de estrategias', () => {
  assert.equal(isRobustSelector({ strategies: [] }), false);
});

test('un CLICK con selector fragil (solo text) se rechaza en validateScenario', () => {
  const scenario = {
    ...baseScenario(),
    steps: [{ id: 'step-1', action: { kind: 'CLICK', selector: { strategies: [{ kind: 'text', value: 'Enviar' }] } } }],
  };
  const result = validateScenario(scenario);
  assert.equal(result.valid, false);
});

// Criterio de aceptacion "Credenciales no se loguean" / error a evitar "Pasar credenciales en prompt", aplicado a TYPE.
test('un TYPE con input LITERAL que parece un secreto real (Bearer-like) se rechaza -- debe usar SECRET_REF', () => {
  const scenario = {
    ...baseScenario(),
    steps: [
      {
        id: 'step-1',
        action: {
          kind: 'TYPE',
          selector: { strategies: [{ kind: 'testId', value: 'password-field' }] },
          input: { kind: 'LITERAL', value: 'Bearer sometoken12345678901234567890' },
        },
      },
    ],
  };
  const result = validateScenario(scenario);
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.reason.includes('SECRET_REF')));
});

test('un TYPE con input LITERAL de formulario normal (no parece secreto) es valido', () => {
  const scenario = {
    ...baseScenario(),
    steps: [
      {
        id: 'step-1',
        action: {
          kind: 'TYPE',
          selector: { strategies: [{ kind: 'testId', value: 'search-field' }] },
          input: { kind: 'LITERAL', value: 'rhia' },
        },
      },
    ],
  };
  assert.equal(validateScenario(scenario).valid, true);
});

test('un TYPE con SECRET_REF valido (referencia corta, nunca el secreto) es aceptado', () => {
  const scenario = {
    ...baseScenario(),
    steps: [
      {
        id: 'step-1',
        action: {
          kind: 'TYPE',
          selector: { strategies: [{ kind: 'testId', value: 'password-field' }] },
          input: { kind: 'SECRET_REF', ref: 'vault:portal-x:password' },
        },
      },
    ],
  };
  assert.equal(validateScenario(scenario).valid, true);
});

// Accion "Retry seguro": clasificacion fija por tipo de accion.
test('isSafelyRetryableAction: NAVIGATE/WAIT_FOR/ASSERT_TEXT son reintentables, CLICK/TYPE nunca', () => {
  assert.equal(isSafelyRetryableAction('NAVIGATE'), true);
  assert.equal(isSafelyRetryableAction('WAIT_FOR'), true);
  assert.equal(isSafelyRetryableAction('ASSERT_TEXT'), true);
  assert.equal(isSafelyRetryableAction('CLICK'), false);
  assert.equal(isSafelyRetryableAction('TYPE'), false);
});

test('maxStepAttempts invalido (0 o no entero) se rechaza', () => {
  assert.equal(validateScenario({ ...baseScenario(), maxStepAttempts: 0 }).valid, false);
  assert.equal(validateScenario({ ...baseScenario(), maxStepAttempts: 1.5 }).valid, false);
  assert.equal(validateScenario({ ...baseScenario(), maxStepAttempts: 3 }).valid, true);
});

test('root no-objeto se rechaza', () => {
  assert.equal(validateScenario('no soy un escenario').valid, false);
  assert.equal(validateScenario(null).valid, false);
});
