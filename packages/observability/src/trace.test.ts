import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTraceContext, startSpan, endSpan, buildTracePath, tracePathIncludesSequence } from './trace.js';

test('createTraceContext rechaza traceId vacio', () => {
  const result = createTraceContext('');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'RHIA_OBS_MISSING_TRACE_ID');
});

test('createTraceContext acepta un traceId real (uuid de execution.trace_id)', () => {
  const result = createTraceContext('11111111-1111-4111-8111-111111111111');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.context.traceId, '11111111-1111-4111-8111-111111111111');
    assert.deepEqual(result.context.spans, []);
  }
});

// "Trace test" (prueba requerida del packet PH11-T001) -- criterio de
// aceptacion "Trace cruza job->model->tool": abre un span de job, dentro de
// el un span de model (ej. una llamada real a AI Gateway), y dentro de ese
// un span de tool (ej. una llamada real a tool-registry/playwright), todos
// bajo el MISMO traceId -- exactamente la forma que produciria un job real
// de agent-runtime que llama al AI Gateway y luego ejecuta una tool.
test('Trace test: un trace cruza job -> model -> tool bajo el mismo traceId', () => {
  const created = createTraceContext('22222222-2222-4222-8222-222222222222');
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const jobSpan = startSpan(created.context, { kind: 'job', label: 'job:RESEARCH_COMPANY' });
  assert.equal(jobSpan.ok, true);
  if (!jobSpan.ok) return;

  const modelSpan = startSpan(jobSpan.context, {
    kind: 'model',
    label: 'model:anthropic/claude',
    parentSpanId: jobSpan.spanId,
  });
  assert.equal(modelSpan.ok, true);
  if (!modelSpan.ok) return;

  const toolSpan = startSpan(modelSpan.context, {
    kind: 'tool',
    label: 'tool:playwright.navigate',
    parentSpanId: modelSpan.spanId,
  });
  assert.equal(toolSpan.ok, true);
  if (!toolSpan.ok) return;

  // Todos los spans comparten el mismo traceId -- el trace real "cruza" las 3 fronteras.
  assert.equal(toolSpan.context.traceId, created.context.traceId);
  assert.equal(toolSpan.context.spans.length, 3);

  const path = buildTracePath(toolSpan.context);
  assert.deepEqual(path, ['job', 'model', 'tool']);
  assert.equal(tracePathIncludesSequence(path, ['job', 'model', 'tool']), true);
  assert.equal(tracePathIncludesSequence(path, ['tool', 'job']), false);

  // Cierra los 3 spans -- outcome real, nunca implicito.
  const closedTool = endSpan(toolSpan.context, toolSpan.spanId, 'OK');
  assert.equal(closedTool.ok, true);
  if (!closedTool.ok) return;
  const closedTail = closedTool.context.spans[closedTool.context.spans.length - 1];
  assert.ok(closedTail);
  assert.equal(closedTail?.outcome, 'OK');
  assert.ok(closedTail?.endedAt);
});

test('startSpan rechaza un parentSpanId que no existe en el contexto', () => {
  const created = createTraceContext('33333333-3333-4333-8333-333333333333');
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = startSpan(created.context, { kind: 'tool', label: 'tool:x', parentSpanId: 'no-existe' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'RHIA_OBS_INVALID_SPAN');
});

test('startSpan rechaza un label vacio', () => {
  const created = createTraceContext('44444444-4444-4444-8444-444444444444');
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = startSpan(created.context, { kind: 'job', label: '' });
  assert.equal(result.ok, false);
});

test('endSpan rechaza un spanId inexistente y un span ya cerrado', () => {
  const created = createTraceContext('55555555-5555-4555-8555-555555555555');
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const missing = endSpan(created.context, 'no-existe', 'OK');
  assert.equal(missing.ok, false);

  const opened = startSpan(created.context, { kind: 'job', label: 'job:x' });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;

  const closedOnce = endSpan(opened.context, opened.spanId, 'OK');
  assert.equal(closedOnce.ok, true);
  if (!closedOnce.ok) return;

  const closedTwice = endSpan(closedOnce.context, opened.spanId, 'ERROR');
  assert.equal(closedTwice.ok, false);
  if (!closedTwice.ok) assert.equal(closedTwice.error.code, 'RHIA_OBS_INVALID_SPAN');
});

test('startSpan/endSpan nunca mutan el TraceContext recibido (inmutable)', () => {
  const created = createTraceContext('66666666-6666-4666-8666-666666666666');
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const before = created.context;
  const opened = startSpan(before, { kind: 'job', label: 'job:x' });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;

  assert.deepEqual(before.spans, []);
  assert.notEqual(opened.context, before);
});
