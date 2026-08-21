import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultRhiaSettings, previewSettingsChange, RhiaSettingsSchema } from '../src/index.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test('defaults seguros y ejemplo de operador validan', async () => {
  assert.equal(RhiaSettingsSchema.safeParse(defaultRhiaSettings).success, true);
  const operator: unknown = JSON.parse(await readFile(resolve(packageRoot, 'examples/operator-settings.json'), 'utf8'));
  assert.equal(RhiaSettingsSchema.safeParse(operator).success, true);
});

test('versión futura, propiedades libres y secretos son rechazados', () => {
  const version = clone(defaultRhiaSettings) as unknown as Record<string, unknown>;
  version['version'] = '2.0';
  assert.equal(RhiaSettingsSchema.safeParse(version).success, false);

  const secret = clone(defaultRhiaSettings) as unknown as Record<string, unknown>;
  secret['apiKey'] = 'valor-no-real';
  assert.equal(RhiaSettingsSchema.safeParse(secret).success, false);
});

test('máximo de toques y pesos inválidos son rechazados', () => {
  const touches = clone(defaultRhiaSettings);
  touches.cadence.maxProactiveTouches = 4;
  assert.equal(RhiaSettingsSchema.safeParse(touches).success, false);

  const weights = clone(defaultRhiaSettings);
  weights.scoring.weights.marketFit = 99;
  assert.equal(RhiaSettingsSchema.safeParse(weights).success, false);
});

test('prioridad regional no puede degradar Ecuador o Perú', () => {
  const settings = clone(defaultRhiaSettings);
  settings.markets.priorities[0] = { countryCode: 'EC', priorityScore: 80 };
  assert.equal(RhiaSettingsSchema.safeParse(settings).success, false);
});

test('provider remoto requiere referencia y budget positivo', () => {
  const missingReference = clone(defaultRhiaSettings);
  missingReference.providers.models.push({
    providerId: 'OPENAI',
    enabled: true,
    mode: 'REMOTE',
    modelAlias: 'remote-default',
    priority: 2,
  });
  assert.equal(RhiaSettingsSchema.safeParse(missingReference).success, false);

  const missingBudget = clone(defaultRhiaSettings);
  missingBudget.providers.models.push({
    providerId: 'OPENAI',
    enabled: true,
    mode: 'REMOTE',
    modelAlias: 'remote-default',
    credentialRef: 'abababab-abab-4bab-8bab-abababababab',
    priority: 2,
  });
  assert.equal(RhiaSettingsSchema.safeParse(missingBudget).success, false);
});

test('orden seguro de herramientas no puede alterarse', () => {
  const settings = clone(defaultRhiaSettings);
  settings.providers.searchOrder = ['PLAYWRIGHT', 'API', 'COMPUTER_USE', 'HUMAN'];
  assert.equal(RhiaSettingsSchema.safeParse(settings).success, false);
});

test('preview distingue hot reload y worker restart sin revelar credentialRef', async () => {
  const operator = JSON.parse(await readFile(resolve(packageRoot, 'examples/operator-settings.json'), 'utf8')) as unknown;
  const preview = previewSettingsChange(defaultRhiaSettings, operator);
  assert.equal(preview.valid, true);
  if (!preview.valid) return;
  assert.equal(preview.highestEffect, 'WORKER_RESTART');
  assert.equal(preview.changes.some((change) => change.path === 'cadence.maxProactiveTouches' && change.effect === 'HOT_RELOAD'), true);
  assert.equal(preview.changes.some((change) => change.path === 'runtime.workerConcurrency' && change.effect === 'WORKER_RESTART'), true);
  assert.equal(JSON.stringify(preview.changes).includes('abababab-abab-4bab-8bab-abababababab'), false);
  assert.equal(JSON.stringify(preview.changes).includes('[SECURE_REFERENCE_SET]'), true);
});

test('preview inválido devuelve issues sin repetir valores de entrada', () => {
  const invalid = clone(defaultRhiaSettings) as unknown as Record<string, unknown>;
  invalid['apiKey'] = 'valor-que-no-debe-volver';
  const preview = previewSettingsChange(defaultRhiaSettings, invalid);
  assert.equal(preview.valid, false);
  assert.equal(JSON.stringify(preview).includes('valor-que-no-debe-volver'), false);
});
