import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ApprovalDecisionSchema,
  ApprovalRequestSchema,
  CallbackEnvelopeSchema,
  ExecutionEventSchema,
  JobRequestSchema,
  JobResultSchema,
  RhiaErrorSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  ToolCallSchema,
  ToolResultSchema,
} from '../src/index.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const examplesDirectory = resolve(packageRoot, 'examples');

const exampleSchemas = {
  'approval-decision.json': ApprovalDecisionSchema,
  'approval-request.json': ApprovalRequestSchema,
  'callback-job-result.json': CallbackEnvelopeSchema,
  'error-retryable.json': RhiaErrorSchema,
  'execution-event.json': ExecutionEventSchema,
  'job-request-resolve-entity.json': JobRequestSchema,
  'job-result-resolve-entity.json': JobResultSchema,
  'search-request.json': SearchRequestSchema,
  'search-response-degraded.json': SearchResponseSchema,
  'tool-call-search.json': ToolCallSchema,
  'tool-result-search.json': ToolResultSchema,
} as const;

test('todos los ejemplos documentados validan', async () => {
  const files = (await readdir(examplesDirectory)).filter((file) => file.endsWith('.json')).sort();
  assert.deepEqual(files, Object.keys(exampleSchemas).sort());
  for (const file of files) {
    const payload: unknown = JSON.parse(await readFile(resolve(examplesDirectory, file), 'utf8'));
    const schema = exampleSchemas[file as keyof typeof exampleSchemas];
    assert.equal(schema.safeParse(payload).success, true, file);
  }
});

test('version es obligatoria y cerrada', async () => {
  const payload = JSON.parse(await readFile(resolve(examplesDirectory, 'job-request-resolve-entity.json'), 'utf8')) as Record<string, unknown>;
  delete payload['version'];
  assert.equal(JobRequestSchema.safeParse(payload).success, false);
  payload['version'] = '2.0';
  assert.equal(JobRequestSchema.safeParse(payload).success, false);
});

test('propiedades desconocidas y campos de secretos se rechazan', async () => {
  const payload = JSON.parse(await readFile(resolve(examplesDirectory, 'tool-call-search.json'), 'utf8')) as Record<string, unknown>;
  payload['apiKey'] = 'valor-no-real-de-prueba';
  assert.equal(ToolCallSchema.safeParse(payload).success, false);
});

test('FAILED requiere error y SUCCEEDED requiere output', async () => {
  const payload = JSON.parse(await readFile(resolve(examplesDirectory, 'job-result-resolve-entity.json'), 'utf8')) as Record<string, unknown>;
  payload['status'] = 'FAILED';
  assert.equal(JobResultSchema.safeParse(payload).success, false);
  delete payload['output'];
  assert.equal(JobResultSchema.safeParse(payload).success, false);
});

test('output.kind debe coincidir con jobType', async () => {
  const payload = JSON.parse(await readFile(resolve(examplesDirectory, 'job-result-resolve-entity.json'), 'utf8')) as {
    output: Record<string, unknown>;
  };
  payload.output['kind'] = 'RESEARCH_COMPANY';
  assert.equal(JobResultSchema.safeParse(payload).success, false);
});

test('códigos de error inválidos son rechazados', () => {
  const invalid = {
    version: '1.0',
    toolCallId: '66666666-6666-4666-8666-666666666666',
    jobId: '11111111-1111-4111-8111-111111111111',
    correlationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    completedAt: '2026-08-20T20:00:02Z',
    success: false,
    error: {
      code: 'error libre',
      message: 'Error sintético',
      retryable: false,
      correlationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      category: 'VALIDATION',
    },
  };
  assert.equal(ToolResultSchema.safeParse(invalid).success, false);
});

test('categoría y retryable deben coincidir con el catálogo', async () => {
  const payload = JSON.parse(await readFile(resolve(examplesDirectory, 'error-retryable.json'), 'utf8')) as Record<string, unknown>;
  payload['category'] = 'VALIDATION';
  assert.equal(RhiaErrorSchema.safeParse(payload).success, false);
  payload['category'] = 'RATE_LIMIT';
  payload['retryable'] = false;
  assert.equal(RhiaErrorSchema.safeParse(payload).success, false);
});

test('la correlación anidada debe coincidir con el envelope', async () => {
  const payload = JSON.parse(await readFile(resolve(examplesDirectory, 'tool-call-search.json'), 'utf8')) as {
    request: Record<string, unknown>;
  };
  payload.request['correlationId'] = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.equal(ToolCallSchema.safeParse(payload).success, false);
});
