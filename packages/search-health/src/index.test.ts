import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSearchEngineComponent,
  buildSearchEngineHealthEvents,
  classifySearchEngineFailure,
  computeEngineHealthScores,
  normalizeUnresponsiveEngines,
  parseSearchEngineComponent,
  type SearchHealthEventRecord,
} from './index.js';

test('buildSearchEngineComponent / parseSearchEngineComponent son inversas', () => {
  assert.equal(buildSearchEngineComponent('brave'), 'search_engine:brave');
  assert.equal(parseSearchEngineComponent('search_engine:brave'), 'brave');
  assert.equal(parseSearchEngineComponent('ai_gateway:openai'), null);
});

test('buildSearchEngineHealthEvents: motor exitoso sin alertas -> evento OK', () => {
  const events = buildSearchEngineHealthEvents({
    query: 'empresa x ecuador',
    motores_detectados: ['brave', 'duckduckgo'],
    motores_no_responden: [],
  });

  assert.deepEqual(
    events.map((e) => [e.component, e.status]).sort(),
    [
      ['search_engine:brave', 'OK'],
      ['search_engine:duckduckgo', 'OK'],
    ],
  );
  assert.deepEqual(events[0]?.detail, { query: 'empresa x ecuador' });
});

test('buildSearchEngineHealthEvents: motor en alerta -> evento con su tipo, no OK', () => {
  const events = buildSearchEngineHealthEvents({
    query: 'empresa y ecuador',
    motores_detectados: [],
    motores_no_responden: [{ motor: 'google cse', motivo: 'HTTP 429 too many requests', tipo: 'RATE_LIMIT' }],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.component, 'search_engine:google cse');
  assert.equal(events[0]?.status, 'RATE_LIMIT');
  assert.deepEqual(events[0]?.detail, { query: 'empresa y ecuador', motivo: 'HTTP 429 too many requests' });
});

test('buildSearchEngineHealthEvents: mismo motor en ambas listas -> gana la alerta', () => {
  const events = buildSearchEngineHealthEvents({
    query: null,
    motores_detectados: ['startpage'],
    motores_no_responden: [{ motor: 'startpage', motivo: 'CAPTCHA required', tipo: 'CAPTCHA' }],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.status, 'CAPTCHA');
});

test('buildSearchEngineHealthEvents: ignora NO_IDENTIFICADO y motores vacíos', () => {
  const events = buildSearchEngineHealthEvents({
    motores_detectados: ['', 'brave'],
    motores_no_responden: [{ motor: 'NO_IDENTIFICADO', motivo: 'x', tipo: 'DESCONOCIDO' }],
  });

  assert.deepEqual(events.map((e) => e.component), ['search_engine:brave']);
});

const eventsAt = (
  entries: readonly (readonly [string, 'OK' | 'RATE_LIMIT' | 'CAPTCHA' | 'CAIDO', string])[],
): SearchHealthEventRecord[] =>
  entries.map(([engine, status, occurredAt]) => ({ component: buildSearchEngineComponent(engine), status, occurredAt }));

test('computeEngineHealthScores: todo OK reciente -> SALUDABLE con score alto', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  const events = eventsAt([
    ['brave', 'OK', '2026-09-02T11:00:00Z'],
    ['brave', 'OK', '2026-09-02T10:00:00Z'],
    ['brave', 'OK', '2026-09-02T09:00:00Z'],
    ['brave', 'OK', '2026-09-01T12:00:00Z'],
  ]);

  const [result] = computeEngineHealthScores(events, { now });
  assert.equal(result?.engine, 'brave');
  assert.equal(result?.classification, 'SALUDABLE');
  assert.ok(result?.score !== null && result.score > 0.95);
});

test('computeEngineHealthScores: mitad fallos transitorios -> INESTABLE, no DEGRADADO', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  const events = eventsAt([
    ['duckduckgo', 'OK', '2026-09-02T11:00:00Z'],
    ['duckduckgo', 'OK', '2026-09-02T10:00:00Z'],
    ['duckduckgo', 'RATE_LIMIT', '2026-09-02T09:00:00Z'],
    ['duckduckgo', 'RATE_LIMIT', '2026-09-02T08:00:00Z'],
  ]);

  const [result] = computeEngineHealthScores(events, { now });
  assert.equal(result?.classification, 'INESTABLE');
});

test('computeEngineHealthScores: alertas duras repetidas -> DEGRADADO', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  const events = eventsAt([
    ['startpage', 'CAPTCHA', '2026-09-02T11:00:00Z'],
    ['startpage', 'CAPTCHA', '2026-09-02T10:00:00Z'],
    ['startpage', 'CAIDO', '2026-09-02T09:00:00Z'],
    ['startpage', 'OK', '2026-08-25T09:00:00Z'],
  ]);

  const [result] = computeEngineHealthScores(events, { now });
  assert.equal(result?.classification, 'DEGRADADO');
});

test('computeEngineHealthScores: sin eventos del engine -> SIN_DATOS, nunca asumido saludable', () => {
  const scores = computeEngineHealthScores([], { now: new Date('2026-09-02T12:00:00Z') });
  assert.deepEqual(scores, []);
});

test('computeEngineHealthScores: pocos eventos -> SIN_DATOS_SUFICIENTES aunque todos sean OK', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  const events = eventsAt([['brave', 'OK', '2026-09-02T11:00:00Z']]);

  const [result] = computeEngineHealthScores(events, { now, minSampleWeight: 3 });
  assert.equal(result?.classification, 'SIN_DATOS_SUFICIENTES');
  assert.ok(result?.score !== null && result.score > 0.9);
});

test('computeEngineHealthScores: eventos fuera de la ventana se ignoran por completo', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  const events = eventsAt([
    ['brave', 'CAIDO', '2026-08-01T00:00:00Z'],
    ['brave', 'CAIDO', '2026-08-02T00:00:00Z'],
    ['brave', 'CAIDO', '2026-08-03T00:00:00Z'],
  ]);

  const scores = computeEngineHealthScores(events, { now, windowDays: 14 });
  assert.deepEqual(scores, []);
});

test('computeEngineHealthScores: el decaimiento hace pesar más lo reciente que lo antiguo', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  // Motor A: 1 fallo muy reciente, 1 éxito antiguo (dentro de la ventana pero ya decaído).
  const engineA = eventsAt([
    ['engine-a', 'CAIDO', '2026-09-02T11:00:00Z'],
    ['engine-a', 'OK', '2026-08-20T12:00:00Z'],
  ]);
  // Motor B: exactamente al revés.
  const engineB = eventsAt([
    ['engine-b', 'OK', '2026-09-02T11:00:00Z'],
    ['engine-b', 'CAIDO', '2026-08-20T12:00:00Z'],
  ]);

  const [scoreA] = computeEngineHealthScores(engineA, { now });
  const [scoreB] = computeEngineHealthScores(engineB, { now });

  assert.ok(scoreA?.score !== null && scoreB?.score !== null);
  assert.ok((scoreA?.score ?? 0) < (scoreB?.score ?? 0), 'el fallo reciente debe pesar más que el éxito antiguo, y viceversa');
});

test('computeEngineHealthScores: ignora componentes que no son de motor de búsqueda', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  const scores = computeEngineHealthScores(
    [{ component: 'ai_gateway:openai', status: 'OK', occurredAt: now.toISOString() }],
    { now },
  );
  assert.deepEqual(scores, []);
});

test('classifySearchEngineFailure: paridad exacta con clasificarMotivoMotor (nodo n8n)', () => {
  assert.equal(classifySearchEngineFailure('CAPTCHA required'), 'CAPTCHA');
  assert.equal(classifySearchEngineFailure('too many requests'), 'RATE_LIMIT');
  assert.equal(classifySearchEngineFailure('HTTP 429'), 'RATE_LIMIT');
  assert.equal(classifySearchEngineFailure('rate limit exceeded'), 'RATE_LIMIT');
  assert.equal(classifySearchEngineFailure('request timeout'), 'TIMEOUT');
  assert.equal(classifySearchEngineFailure('timed out'), 'TIMEOUT');
  assert.equal(classifySearchEngineFailure('Suspended: CAPTCHA'), 'CAPTCHA'); // captcha se evalúa antes que suspend
  assert.equal(classifySearchEngineFailure('Suspended'), 'SUSPENDIDO');
  assert.equal(classifySearchEngineFailure('connection error'), 'CAIDO');
  assert.equal(classifySearchEngineFailure('engine is down'), 'CAIDO');
  assert.equal(classifySearchEngineFailure('unreachable host'), 'CAIDO');
  assert.equal(classifySearchEngineFailure('algo raro sin clasificar'), 'DESCONOCIDO');
  assert.equal(classifySearchEngineFailure(null), 'DESCONOCIDO');
  assert.equal(classifySearchEngineFailure(undefined), 'DESCONOCIDO');
});

test('normalizeUnresponsiveEngines: acepta tuplas [motor,motivo] (forma real de SearXNG)', () => {
  const normalized = normalizeUnresponsiveEngines([
    ['brave', 'too many requests'],
    ['duckduckgo', 'CAPTCHA'],
    ['startpage', 'Suspended: CAPTCHA'],
  ]);
  assert.deepEqual(normalized, [
    { motor: 'brave', motivo: 'too many requests', tipo: 'RATE_LIMIT' },
    { motor: 'duckduckgo', motivo: 'CAPTCHA', tipo: 'CAPTCHA' },
    { motor: 'startpage', motivo: 'Suspended: CAPTCHA', tipo: 'CAPTCHA' },
  ]);
});

test('normalizeUnresponsiveEngines: acepta strings sueltos y objetos {motor,motivo}', () => {
  const normalized = normalizeUnresponsiveEngines(['brave', { motor: 'google cse', motivo: 'timeout' }]);
  assert.deepEqual(normalized, [
    { motor: 'brave', motivo: 'NO_IDENTIFICADO', tipo: 'DESCONOCIDO' },
    { motor: 'google cse', motivo: 'timeout', tipo: 'TIMEOUT' },
  ]);
});

test('normalizeUnresponsiveEngines: valores no-array devuelven []', () => {
  assert.deepEqual(normalizeUnresponsiveEngines(null), []);
  assert.deepEqual(normalizeUnresponsiveEngines(undefined), []);
  assert.deepEqual(normalizeUnresponsiveEngines('no es un array'), []);
});
