import { test } from "node:test";
import assert from "node:assert/strict";
import { CANDIDATES } from "./candidates.js";
import { ALL_CASES } from "./dataset/index.js";
import { runBenchmark } from "./harness.js";

test("harness: es reproducible -- re-correr el mismo subset produce los mismos scores (pruebas requeridas del packet)", async () => {
  const subset = ALL_CASES.slice(0, 4);
  const first = await runBenchmark(CANDIDATES, subset);
  const second = await runBenchmark(CANDIDATES, subset);
  assert.deepEqual(
    first.map((r) => ({ candidateId: r.candidateId, caseId: r.taskCase.id, score: r.score })),
    second.map((r) => ({ candidateId: r.candidateId, caseId: r.taskCase.id, score: r.score })),
  );
});

test("harness: diferencia candidatos por calidad -- premium no obtiene peor score que economy", async () => {
  const results = await runBenchmark(CANDIDATES, ALL_CASES);
  const premium = results.filter((r) => r.candidateId === "openai:gpt-5");
  const economy = results.filter((r) => r.candidateId === "openai:gpt-5-mini");
  assert.equal(premium.length, ALL_CASES.length);
  assert.equal(economy.length, ALL_CASES.length);

  const premiumAvg = premium.reduce((sum, r) => sum + r.score, 0) / premium.length;
  const economyAvg = economy.reduce((sum, r) => sum + r.score, 0) / economy.length;
  assert.ok(premiumAvg > economyAvg, `premium (${premiumAvg}) deberia superar a economy (${economyAvg})`);
  assert.equal(premiumAvg, 1);
});

test("harness: registra costo y latencia reales por corrida", async () => {
  const results = await runBenchmark(CANDIDATES, ALL_CASES.slice(0, 2));
  for (const r of results) {
    assert.ok(r.latencyMs >= 0, `latencyMs invalido en ${r.candidateId}/${r.taskCase.id}`);
    assert.ok(r.costUsd >= 0, `costUsd invalido en ${r.candidateId}/${r.taskCase.id}`);
  }
});

test("harness: el candidato local (ollama, local_only) siempre reporta costo real cero, no estimado", async () => {
  const ollamaOnly = CANDIDATES.filter((c) => c.provider === "ollama");
  const results = await runBenchmark(ollamaOnly, ALL_CASES);
  for (const r of results) {
    assert.equal(r.costUsd, 0, `Ollama deberia costar 0 (ejecucion local), no ${r.costUsd}`);
  }
});

test("harness: un candidato con tool_selection incorrecto obtiene score 0 en ese caso (BENCH-TS-003)", async () => {
  const caseTS003 = ALL_CASES.find((c) => c.id === "BENCH-TS-003");
  assert.ok(caseTS003);
  const results = await runBenchmark(
    CANDIDATES.filter((c) => c.id === "openai:gpt-5-mini"),
    [caseTS003 as NonNullable<typeof caseTS003>],
  );
  assert.equal(results[0]?.score, 0, "gpt-5-mini responde enviar_email en vez de escalar_aprobacion: debe fallar.");
});
