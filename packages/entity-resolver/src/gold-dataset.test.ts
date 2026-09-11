// GATE-04 -- pruebas de regresion reales sobre el gold dataset
// entity-resolution-ec-pe-v1 (100 pares reales EC/PE, aportados por el
// usuario el 2026-09-07). No son umbrales inventados: los numeros exactos
// de abajo son el resultado real de correr @rhia/entity-resolver contra el
// dataset (ver gold-dataset.eval.ts / docs/gold-datasets/entity-resolution-ec-pe-v1-results.md
// para el reporte completo). Si una futura edicion del resolver o del
// dataset cambia estos numeros, esta prueba debe fallar -- eso es lo que
// se busca: proteger contra una regresion silenciosa del criterio de
// aceptacion de GATE-04 ("Entity resolution supera gold dataset").

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGoldDataset, runGoldDatasetEvaluation } from './gold-dataset.js';

test('gold dataset: el safety rail nunca fusiona entidades de paises declarados distintos sin ownership/legal-id (Escenario A)', () => {
  const dataset = loadGoldDataset();
  const report = runGoldDatasetEvaluation(dataset);
  assert.equal(report.scenarioA.totalRows, 100);
  assert.deepEqual(report.scenarioA.incorrectlyMerged, []);
  assert.equal(report.scenarioA.correctlySeparate, 100);
});

test('gold dataset: con las señales reales disponibles (ownership solo donde el dataset lo declara), precision y recall son perfectos sobre SAME_GROUP/DIRECT_LINK vs DISTINCT (Escenario B)', () => {
  const dataset = loadGoldDataset();
  const report = runGoldDatasetEvaluation(dataset);
  assert.equal(report.scenarioB.positives, 84, 'SAME_GROUP (83) + DIRECT_LINK (1)');
  assert.equal(report.scenarioB.negatives, 12, 'DISTINCT');
  assert.equal(report.scenarioB.excludedAmbiguous, 4, 'GLOBAL_NETWORK, reportado aparte a proposito');
  assert.equal(report.scenarioB.truePositives, 84);
  assert.equal(report.scenarioB.falseNegatives, 0);
  assert.equal(report.scenarioB.trueNegatives, 12);
  assert.equal(report.scenarioB.falsePositives, 0);
  assert.equal(report.scenarioB.precision, 1);
  assert.equal(report.scenarioB.recall, 1);
});

test('gold dataset: los 4 casos GLOBAL_NETWORK quedan documentados y no se fuerzan a un veredicto sin señal de ownership real', () => {
  const dataset = loadGoldDataset();
  const report = runGoldDatasetEvaluation(dataset);
  const ids = report.scenarioB.ambiguousRows.map((r) => r.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [94, 95, 96, 97], 'Deloitte, PwC, EY, KPMG');
});

test('el dataset conserva 100 filas y la distribucion de etiquetas esperada (protege contra una edicion accidental del archivo)', () => {
  const dataset = loadGoldDataset();
  assert.equal(dataset.rows.length, 100);
  assert.deepEqual(dataset.labelCounts, { SAME_GROUP: 83, DISTINCT: 12, GLOBAL_NETWORK: 4, DIRECT_LINK: 1 });
});
