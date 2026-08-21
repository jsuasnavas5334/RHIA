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
    assert.equal(summary.dominios_unicos_globales, 0, 'El gap del parser de dominios dejó de reproducirse; actualizar el baseline');
    assert.equal(diagnostics[0].resultados_con_url, 20);
    assert.ok(diagnostics.slice(1).every((item) => item.siguiente_accion_consulta === 'REFORMULAR_CONSULTA'));

    report.push({ id: testCase.id, result: 'PASS', classification: summary.salud_tecnica_global, repeatMs: health.elapsedMs, knownGaps: 2 });
    continue;
  }

  assert.fail(`Categoría de caso no soportada: ${testCase.category}`);
}

for (const result of report) {
  console.log(`PASS ${result.id} | ${result.classification} | dos ejecuciones ${result.repeatMs.toFixed(2)} ms`);
}
console.log(`Baseline comercial verificado: ${report.length}/${cases.length} casos; costo externo: 0 (record/replay local).`);
