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

test('la auditoría HTTP tiene plazo y no bloquea indefinidamente la respuesta', async (t) => {
  // Hallazgo SES-20260911-108 (docs/progress/PH10-T002.md): en Node 22.22.2
  // este test cancelaba de forma reproducible (100% de las corridas, ver
  // docs/progress/PH10-T002.md, sección "Hallazgo abierto" y su Update de
  // SES-20260911-109) con failureType 'cancelledByParent' / "Promise
  // resolution is still pending but the event loop has already resolved".
  // Causa raíz real (no simulada, confirmada con repro aislado + fuentes
  // públicas nodejs/node#49952, #52304, #37683): el runner de node:test
  // puede marcar así un test cuando la única referencia que mantiene vivo el
  // event loop durante un `Promise.race` es un timer `.unref()`-eado (el de
  // `settleAuthAudit`, correcto y necesario en producción para no bloquear
  // el apagado del proceso) y la promesa "perdedora" de la carrera queda
  // referenciada sin resolver. No es un bug de `settleAuthAudit`: el fix es
  // mantener vivo el event loop solo durante ESTE test (nunca en
  // producción) con un handle propio, liberado siempre en `t.after`.
  const keepAlive = setInterval(() => undefined, 1_000_000);
  t.after(() => clearInterval(keepAlive));
  const startedAt = Date.now();
  await settleAuthAudit(new Promise<void>(() => undefined), 5);
  assert.equal(Date.now() - startedAt < 250, true);
});
