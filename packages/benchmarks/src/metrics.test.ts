import { test } from "node:test";
import assert from "node:assert/strict";
import { CANDIDATES } from "./candidates.js";
import { ALL_CASES } from "./dataset/index.js";
import { runBenchmark } from "./harness.js";
import { aggregateAll } from "./metrics.js";

test("metrics: produce un ModelProfile valido por candidato (consumible por @rhia/model-router)", async () => {
  const results = await runBenchmark(CANDIDATES, ALL_CASES);
  const aggregates = aggregateAll(CANDIDATES, results);
  assert.equal(aggregates.length, CANDIDATES.length);

  for (const a of aggregates) {
    assert.ok(a.profile.qualityScore >= 0 && a.profile.qualityScore <= 1, `qualityScore fuera de rango en ${a.candidateId}`);
    assert.ok(a.profile.estCostPerTaskUsd >= 0, `estCostPerTaskUsd invalido en ${a.candidateId}`);
    assert.ok(a.profile.maxLatencyMsP95 > 0, `maxLatencyMsP95 invalido en ${a.candidateId}`);
    assert.equal(a.byTaskClass.length, 4, `deberia tener desglose de las 4 task classes en ${a.candidateId}`);
    assert.equal(a.n, ALL_CASES.length);
  }
});

test("metrics: el candidato premium tiene calidad mayor o igual a todos los demas", async () => {
  const results = await runBenchmark(CANDIDATES, ALL_CASES);
  const aggregates = aggregateAll(CANDIDATES, results);
  const premium = aggregates.find((a) => a.candidateId === "openai:gpt-5");
  assert.ok(premium);
  for (const a of aggregates) {
    assert.ok(
      (premium as NonNullable<typeof premium>).overallQualityScore >= a.overallQualityScore,
      `premium (${premium?.overallQualityScore}) deberia ser >= ${a.candidateId} (${a.overallQualityScore})`,
    );
  }
});

test("metrics: la latencia p95 del candidato local (ollama) es menor que la del premium (delay simulado)", async () => {
  const results = await runBenchmark(CANDIDATES, ALL_CASES);
  const aggregates = aggregateAll(CANDIDATES, results);
  const ollama = aggregates.find((a) => a.candidateId === "ollama:llama3.1-8b");
  const premium = aggregates.find((a) => a.candidateId === "openai:gpt-5");
  assert.ok(ollama && premium);
  assert.ok(
    (ollama as NonNullable<typeof ollama>).profile.maxLatencyMsP95 <
      (premium as NonNullable<typeof premium>).profile.maxLatencyMsP95,
  );
});
