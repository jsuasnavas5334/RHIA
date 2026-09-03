import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AiGateway,
  createAnthropicAdapter,
  createOllamaAdapter,
  createOpenAiAdapter,
  FakeTransport,
} from "@rhia/ai-gateway";
import { InMemoryBudgetLedger, ModelRouter, systemClock } from "@rhia/model-router";
import type { TaskClassPolicy } from "@rhia/model-router";
import { CANDIDATES } from "./candidates.js";
import { ALL_CASES } from "./dataset/index.js";
import { runBenchmark } from "./harness.js";
import { aggregateAll } from "./metrics.js";

// Validacion final del packet PH05-T004: "Router consume resultados del
// benchmark". Este test prueba que los ModelProfile producidos por el
// benchmark son directamente utilizables como candidateTiers de una
// TaskClassPolicy real de @rhia/model-router (PH05-T003), sin transformacion
// adicional.
test("validacion final PH05-T004: el ModelRouter consume los ModelProfile generados por el benchmark", async () => {
  const results = await runBenchmark(CANDIDATES, ALL_CASES);
  const aggregates = aggregateAll(CANDIDATES, results);
  const profiles = aggregates.map((a) => a.profile).sort((a, b) => b.qualityScore - a.qualityScore);

  assert.ok(profiles.length > 0);
  assert.equal(profiles[0]?.provider, "openai", "el perfil de mayor calidad benchmarkeada deberia ser el premium.");

  const policy: TaskClassPolicy = {
    taskClassId: "entity_resolution",
    minQualityScore: 0,
    minConfidence: 0.8,
    requiresLocalOnly: false,
    candidateTiers: [profiles],
  };

  const gateway = new AiGateway(
    [createOpenAiAdapter(), createAnthropicAdapter(), createOllamaAdapter()],
    new FakeTransport([
      {
        kind: "respond",
        status: 200,
        body: {
          choices: [
            { message: { role: "assistant", content: "Accion: RESOLVER_ENTIDAD_COMERCIAL." }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      },
    ]),
  );
  const router = new ModelRouter(gateway, new InMemoryBudgetLedger(systemClock), {
    dailyLimitUsd: 100,
    monthlyLimitUsd: 1000,
  });

  const decision = await router.route(
    {
      requestId: "router-integration-ph05-t004",
      taskClassId: "entity_resolution",
      messages: [{ role: "user", content: [{ type: "text", text: "hola" }] }],
      tools: [],
      responseFormat: { kind: "text" },
      maxOutputTokens: 128,
      temperature: 0,
    },
    policy,
    { timeoutMs: 2000 },
  );

  assert.ok(decision.chosen !== null, `El router deberia elegir un modelo. Explicacion: ${decision.explanation}`);
  assert.equal(decision.chosen?.provider, "openai");
});
