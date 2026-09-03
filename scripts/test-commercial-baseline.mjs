import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const casesPath = path.join(repoRoot, 'tests', 'baseline', 'commercial_cases.json');
const workflowPath = path.join(repoRoot, 'docs', 'baseline', 'n8n', 'workflows', 'KV6AIXyIPWKSaTAp.json');

const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8')).cases;
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nodeCode(name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `No se encontró el nodo ${name}`);
  const code = node.parameters?.jsCode;
  assert.equal(typeof code, 'string', `${name} no contiene jsCode`);

  const referencedGlobals = [...code.matchAll(/\$[A-Za-z_][A-Za-z0-9_]*/g)].map((match) => match[0]);
  assert.deepEqual([...new Set(referencedGlobals)], ['$input'], `${name} usa globals n8n no aislados`);
  return code;
}

function runNode(name, jsonItems) {
  const code = nodeCode(name);
  const context = vm.createContext(Object.create(null));
  const execute = vm.runInContext(`(function ($input) {\n${code}\n})`, context, {
    filename: `${name}.baseline.js`,
    timeout: 2_000,
  });
  const items = clone(jsonItems).map((json) => ({ json }));
  return clone(execute({ all: () => items }));
}

function runResolution(evaluationInputs) {
  const evaluated = runNode('Evaluar evidencia entidad', evaluationInputs);
  return runNode('Consolidar evidencia por mercado', evaluated.map((item) => item.json));
}

function runSearchHealth(searchResponses) {
  return runNode('Diagnosticar salud búsqueda', searchResponses);
}

function assertRepeatable(run) {
  const started = process.hrtime.bigint();
  const first = run();
  const second = run();
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  assert.deepEqual(second, first, 'Dos ejecuciones no produjeron clasificación equivalente');
  return { output: first, elapsedMs };
}

const report = [];

for (const testCase of cases) {
  if (testCase.category === 'CLEAR_ENTITY') {
    const resolution = assertRepeatable(() => runResolution(testCase.evaluationInputs));
    const health = assertRepeatable(() => runSearchHealth(testCase.searchResponses));
    const market = resolution.output[0].json;
    const summary = health.output[0].json.salud_busqueda_global;

    assert.equal(resolution.output.length, testCase.expected.marketCount);
    assert.equal(market.estado_resolucion_mercado, testCase.expected.marketState);
    assert.equal(market.siguiente_accion, testCase.expected.marketAction);
    assert.ok(market.total_evidencia_fuerte >= testCase.expected.minimumStrongEvidence);
    assert.ok(market.cantidad_fuentes_unicas >= testCase.expected.minimumUniqueSources);
    assert.equal(summary.salud_tecnica_global, testCase.expected.searchHealth);
    assert.equal(summary.cobertura_global, testCase.expected.searchCoverage);

    report.push({ id: testCase.id, result: 'PASS', classification: market.estado_resolucion_mercado, repeatMs: resolution.elapsedMs + health.elapsedMs });
    continue;
  }

  if (testCase.category === 'AMBIGUOUS_GEOGRAPHY') {
    const resolution = assertRepeatable(() => runResolution(testCase.evaluationInputs));
    assert.equal(resolution.output.length, testCase.expected.marketCount);
    for (const item of resolution.output) {
      assert.notEqual(item.json.estado_resolucion_mercado, testCase.expected.forbiddenState);
      assert.equal(item.json.siguiente_accion, testCase.expected.marketAction);
      assert.equal(item.json.requiere_mas_evidencia, testCase.expected.requiresMoreEvidence);
    }
    report.push({ id: testCase.id, result: 'PASS', classification: 'AMBIGUA_REQUIERE_MAS_EVIDENCIA', repeatMs: resolution.elapsedMs });
    continue;
  }

  if (testCase.category === 'NO_RESULTS_HEALTHY') {
    const resolution = assertRepeatable(() => runResolution(testCase.evaluationInputs));
    const health = assertRepeatable(() => runSearchHealth(testCase.searchResponses));
    const market = resolution.output[0].json;
    const summary = health.output[0].json.salud_busqueda_global;

    assert.equal(resolution.output.length, testCase.expected.marketCount);
    assert.equal(market.estado_resolucion_mercado, testCase.expected.marketState);
    assert.equal(market.siguiente_accion, testCase.expected.marketAction);
    assert.equal(summary.salud_tecnica_global, testCase.expected.searchHealth);
    assert.equal(summary.cobertura_global, testCase.expected.searchCoverage);
    assert.equal(summary.estado_busqueda_global, testCase.expected.searchState);
    assert.equal(summary.siguiente_accion_global, testCase.expected.searchAction);

    // PH06-T001, criterio de aceptación: "Healthy no-results genera
    // REFORMULATE". Motores sin alertas (unresponsive_engines: []) y sin
    // resultados deben producir REFORMULAR_CONSULTA a nivel de consulta,
    // nunca RETRY_BACKOFF (ese es solo para degradación técnica real).
    const perQueryActions = health.output.map((item) => item.json.diagnostico_busqueda.siguiente_accion_consulta);
    assert.ok(perQueryActions.every((accion) => accion === 'REFORMULAR_CONSULTA'), 'Consulta saludable sin resultados debe reformular, no reintentar con backoff');

    report.push({ id: testCase.id, result: 'PASS', classification: summary.estado_busqueda_global, repeatMs: resolution.elapsedMs + health.elapsedMs });
    continue;
  }

  if (testCase.category === 'TECHNICAL_DEGRADATION') {
    const fixturePath = path.join(repoRoot, ...testCase.fixture.split('/'));
    const recorded = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const raw = recorded.map(({ diagnostico_busqueda, salud_busqueda_global, ...item }) => item);
    const health = assertRepeatable(() => runSearchHealth(raw));
    const summary = health.output[0].json.salud_busqueda_global;

    assert.equal(health.output.length, testCase.expected.queryCount);
    assert.equal(summary.consultas_con_resultados, testCase.expected.queriesWithResults);
    assert.equal(summary.total_resultados, testCase.expected.totalResults);
    assert.equal(summary.salud_tecnica_global, testCase.expected.searchHealth);
    assert.equal(summary.cobertura_global, testCase.expected.searchCoverage);
    assert.equal(summary.estado_busqueda_global, testCase.expected.searchState);
    assert.equal(summary.siguiente_accion_global, testCase.expected.searchAction);

    const diagnostics = health.output.map((item) => item.json.diagnostico_busqueda);
    assert.deepEqual(diagnostics, recorded.map((item) => item.diagnostico_busqueda), 'El replay difiere de la evidencia guardada');
    // PH06-T001: el parser de dominios y la clasificación de reintentos ante
    // alertas de motor (429/CAPTCHA) ya están corregidos (ver
    // docs/progress/PH06-T001.md). Este baseline ahora fija el
    // comportamiento correcto en vez del bug histórico documentado en
    // PLAN_MAESTRO.md/CLAUDE.md.
    assert.equal(diagnostics[0].dominios_unicos, 15, 'El parser de dominios debe extraer los 15 dominios únicos reales de las 20 URLs de la consulta 1');
    assert.equal(summary.dominios_unicos_globales, 15, 'El parser de dominios dejó de fallar; si este número cambia, actualizar el baseline junto con la fixture');
    assert.equal(diagnostics[0].resultados_con_url, 20);
    assert.ok(diagnostics.slice(1).every((item) => item.siguiente_accion_consulta === 'RETRY_BACKOFF'), 'Consultas sin resultados con motores en alerta (429/CAPTCHA) deben reintentar con backoff, no reformular');

    report.push({ id: testCase.id, result: 'PASS', classification: summary.salud_tecnica_global, repeatMs: health.elapsedMs, knownGaps: 0 });
    continue;
  }

  if (testCase.category === 'RATE_LIMIT_ISOLATED') {
    // PH06-T001, criterio de aceptación: "429 genera RETRY_BACKOFF".
    // Reproducción mínima y aislada (sin depender del fixture de 18
    // consultas) de una única consulta degradada por rate-limit/CAPTCHA.
    const health = assertRepeatable(() => runSearchHealth(testCase.searchResponses));
    const diagnostico = health.output[0].json.diagnostico_busqueda;

    assert.equal(diagnostico.estado_resultados, testCase.expected.estadoResultados);
    assert.equal(diagnostico.siguiente_accion_consulta, testCase.expected.queryAction);
    assert.deepEqual(diagnostico.motores_no_responden.map((m) => m.tipo), testCase.expected.engineTypes);

    // PH06-T001, acción pendiente 4/5: cada motor en alerta debe producir un
    // evento de salud (component='search_engine:<motor>', status=tipo), listo
    // para persistirse en rhia.system_health_event y alimentar el health
    // score por engine (packages/search-health).
    assert.deepEqual(
      diagnostico.search_health_events.map((e) => [e.component, e.status]).sort(),
      [
        ['search_engine:duckduckgo', 'CAPTCHA'],
        ['search_engine:google cse', 'RATE_LIMIT'],
      ],
      'Los eventos de salud por motor deben reflejar exactamente las alertas de esta consulta',
    );

    report.push({ id: testCase.id, result: 'PASS', classification: diagnostico.siguiente_accion_consulta, repeatMs: health.elapsedMs });
    continue;
  }

  assert.fail(`Categoría de caso no soportada: ${testCase.category}`);
}

for (const result of report) {
  console.log(`PASS ${result.id} | ${result.classification} | dos ejecuciones ${result.repeatMs.toFixed(2)} ms`);
}
console.log(`Baseline comercial verificado: ${report.length}/${cases.length} casos; costo externo: 0 (record/replay local).`);
