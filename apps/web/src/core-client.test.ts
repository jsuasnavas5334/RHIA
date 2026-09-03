import assert from 'node:assert/strict';
import test from 'node:test';
import { CoreClientError, RhiaCoreClient } from './core-client.ts';

const jobId = '11111111-1111-4111-8111-111111111111';
const approvalId = '22222222-2222-4222-8222-222222222222';

test('lista jobs sin exponer input ni IDs en el resumen', async () => {
  const client = new RhiaCoreClient('http://127.0.0.1:4100', async () => new Response(JSON.stringify({
    version: '1.0', data: [{ id: jobId, jobType: 'RESOLVE_ENTITY', status: 'FAILED', input: { secret: 'no-ui' }, retryCount: 1, updatedAt: '2026-08-21T20:00:00.000Z' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  const jobs = await client.listJobs('better-auth.session_token=opaque');
  assert.equal(jobs[0]?.status, 'FAILED');
  assert.match(jobs[0]?.traceSummary ?? '', /falló/);
  assert.equal(JSON.stringify(jobs).includes('no-ui'), false);
});

test('obtiene roles desde la sesión autorizada por Core sin aceptar valores inventados', async () => {
  const client = new RhiaCoreClient('http://127.0.0.1:4100', async () => new Response(JSON.stringify({
    version: '1.0', data: { roles: ['MANAGER'] },
  }), { status: 200 }));
  assert.deepEqual(await client.getSession('session=opaque'), { roles: ['MANAGER'] });

  const invalid = new RhiaCoreClient('http://127.0.0.1:4100', async () => new Response(JSON.stringify({
    version: '1.0', data: { roles: ['SUPERUSER'] },
  }), { status: 200 }));
  await assert.rejects(invalid.getSession('session=opaque'), /sesión inválida/);
});

test('retry reenvía cookie opaca y genera correlación e idempotencia en servidor', async () => {
  let captured: Readonly<{ url: string; init?: RequestInit }> | undefined;
  const client = new RhiaCoreClient('http://localhost:4100', async (input, init) => {
    captured = { url: String(input), ...(init ? { init } : {}) };
    return new Response(JSON.stringify({ version: '1.0', data: { id: jobId }, meta: { idempotentReplay: false } }), { status: 200 });
  });
  await client.commandJob('better-auth.session_token=opaque', jobId, 'retry');
  assert.equal(captured?.url, `http://localhost:4100/api/v1/jobs/${jobId}/retry`);
  const headers = new Headers(captured?.init?.headers);
  assert.equal(headers.get('cookie'), 'better-auth.session_token=opaque');
  assert.match(headers.get('x-correlation-id') ?? '', /^[0-9a-f-]{36}$/);
  const body = JSON.parse(String(captured?.init?.body)) as { idempotencyKey: string };
  assert.match(body.idempotencyKey, /^[0-9a-f-]{36}$/);
  assert.equal(captured?.init?.cache, 'no-store');
});

test('decisión valida entrada y propaga solo error seguro de Core', async () => {
  const client = new RhiaCoreClient('https://core.example.invalid', async () => new Response(JSON.stringify({
    error: { message: 'La persona solicitante no puede aprobar su propia acción.', internal: 'no-exponer' },
  }), { status: 403 }));
  await assert.rejects(client.decideApproval('session=opaque', approvalId, 'APPROVED', 'Revisión separada'),
    (error: unknown) => error instanceof CoreClientError && error.status === 403 && !error.message.includes('no-exponer'));
  await assert.rejects(client.decideApproval('session=opaque', 'not-an-id', 'APPROVED', ''), /requiere una approval válida/);
});

test('origen inseguro o cookie ausente fallan antes de transmitir', async () => {
  assert.throws(() => new RhiaCoreClient('http://core.example.invalid'), /HTTPS o HTTP loopback/);
  const client = new RhiaCoreClient('http://127.0.0.1:4100', async () => { throw new Error('no debe invocarse'); });
  await assert.rejects(client.listApprovals(''), /Inicia sesión/);
});
