import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { recordAuthHttpOutcome, settleAuthAudit } from './security-audit.js';

test('audita fallos y rate limit sin incluir identidad ni credenciales', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool = {
    query: async (sql: string, values: unknown[]) => {
      calls.push({ sql, values });
      return { rows: [], rowCount: 1 };
    },
  } as unknown as Pool;

  await recordAuthHttpOutcome(pool, '/api/auth/get-session', 401);
  await recordAuthHttpOutcome(pool, '/api/auth/sign-in/email', 200);
  await recordAuthHttpOutcome(pool, '/api/auth/sign-in/email', 401);
  await recordAuthHttpOutcome(pool, '/api/auth/sign-in/email', 429);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.values), [
    ['LOGIN_FAILED', '/api/auth/sign-in/email', 401],
    ['LOGIN_RATE_LIMITED', '/api/auth/sign-in/email', 429],
  ]);
  assert.equal(JSON.stringify(calls).includes('email'), true);
  assert.equal(JSON.stringify(calls).includes('@'), false);
  assert.equal(JSON.stringify(calls).includes('password'), false);
  assert.equal(JSON.stringify(calls).includes('token'), false);
});

test('la auditoría HTTP tiene plazo y no bloquea indefinidamente la respuesta', async () => {
  const startedAt = Date.now();
  await settleAuthAudit(new Promise<void>(() => undefined), 5);
  assert.equal(Date.now() - startedAt < 250, true);
});
