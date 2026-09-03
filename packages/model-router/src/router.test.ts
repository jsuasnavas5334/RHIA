import { test } from "node:test";
import assert from "node:assert/strict";
import { AiGateway, FakeTransport, createOpenAiAdapter, createAnthropicAdapter, createOllamaAdapter } from "@rhia/ai-gateway";
import { ModelRouter } from "./router.js";
import { InMemoryBudgetLedger, type Clock } from "./budget.js";
import { makeProfile, makePolicy, testMessages } from "./testing/fixtures.js";

const FIXED_CLOCK: Clock = { now: () => new Date("2026-08-29T10:00:00Z") };

function baseRouteRequest(taskClassId: string) {
  return {
    requestId: "route-1",
    taskClassId,
    messages: testMessages("hola"),
    tools: [],
    responseFormat: { kind: "text" as const },
    maxOutputTokens: 256,
    temperature: 0,
  };
}

test("router: elige el primer candidato que cumple el umbral de confianza (tier economy)", async () => {
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: {
        choices: [{ message: { role: "assistant", content: "respuesta economica" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      },
    },
  ]);
  const gateway = new AiGateway([createOpenAiAdapter()], transport);
  const ledger = new InMemoryBudgetLedger(FIXED_CLOCK);
  const router = new ModelRouter(gateway, ledger, { dailyLimitUsd: 10, monthlyLimitUsd: 100 });

  const economy = makeProfile({ provider: "openai", model: "gpt-5-mini", tier: "economy" });
  const policy = makePolicy({ taskClassId: "resumen", candidateTiers: [[economy]] });

  const decision = await router.route(baseRouteRequest("resumen"), policy, { timeoutMs: 1000 });

  assert.notEqual(decision.chosen, null);
  assert.equal(decision.chosen?.tier, "economy");
  assert.equal(decision.attempts.length, 1);
  assert.equal(decision.attempts[0]?.outcome, "SUCCEEDED");
  assert.match(decision.explanation, /Se eligió/);
  assert.equal(ledger.getDailyUsage().taskCount, 1);
});

test("router: baja confianza en economy escala a premium sin agotar mas presupuesto del necesario", async () => {
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: {
        choices: [{ message: { role: "assistant", content: "respuesta cortada" }, finish_reason: "length" }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      },
    },
    {
      kind: "respond",
      status: 200,
      body: {
        content: [{ type: "text", text: "respuesta completa y segura" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 6 },
      },
    },
  ]);
  const gateway = new AiGateway([createOpenAiAdapter(), createAnthropicAdapter()], transport);
  const ledger = new InMemoryBudgetLedger(FIXED_CLOCK);
  const router = new ModelRouter(gateway, ledger, { dailyLimitUsd: 10, monthlyLimitUsd: 100 });

  const economy = makeProfile({ provider: "openai", model: "gpt-5-mini", tier: "economy" });
  const premium = makeProfile({ provider: "anthropic", model: "claude-premium", tier: "premium", estCostPerTaskUsd: 0.05 });
  const policy = makePolicy({ taskClassId: "extraccion", minConfidence: 0.8, candidateTiers: [[economy], [premium]] });

  const decision = await router.route(baseRouteRequest("extraccion"), policy, { timeoutMs: 1000 });

  assert.equal(decision.chosen?.tier, "premium");
  assert.equal(decision.attempts.length, 2);
  assert.equal(decision.attempts[0]?.outcome, "SUCCEEDED");
  assert.ok((decision.attempts[0]?.confidence ?? 1) < 0.8, "el primer intento debe quedar por debajo del umbral");
  assert.equal(decision.attempts[1]?.outcome, "SUCCEEDED");
  assert.match(decision.explanation, /premium/);
});

test("router: no excede el budget diario -- salta el candidato y lo registra sin llamar al gateway", async () => {
  const transport = new FakeTransport([]); // no debe usarse
  const gateway = new AiGateway([createOpenAiAdapter()], transport);
  const ledger = new InMemoryBudgetLedger(FIXED_CLOCK);
  const router = new ModelRouter(gateway, ledger, { dailyLimitUsd: 0.001, monthlyLimitUsd: 100 });

  const costly = makeProfile({ provider: "openai", model: "gpt-5", tier: "premium", estCostPerTaskUsd: 5 });
  const policy = makePolicy({ taskClassId: "reporte", candidateTiers: [[costly]] });

  const decision = await router.route(baseRouteRequest("reporte"), policy, { timeoutMs: 1000 });

  assert.equal(decision.chosen, null);
  assert.equal(decision.attempts[0]?.outcome, "SKIPPED_BUDGET");
  assert.equal(transport.requests.length, 0);
  assert.equal(ledger.getDailyUsage().taskCount, 0);
});

test("router: outage del primer proveedor -- falla y pasa al siguiente sin duplicar exito", async () => {
  const transport = new FakeTransport([
    { kind: "throw", message: "network down" },
    {
      kind: "respond",
      status: 200,
      body: { message: { role: "assistant", content: "respuesta local" }, done: true, prompt_eval_count: 2, eval_count: 2 },
    },
  ]);
  const gateway = new AiGateway([createOpenAiAdapter(), createOllamaAdapter()], transport);
  const ledger = new InMemoryBudgetLedger(FIXED_CLOCK);
  const router = new ModelRouter(gateway, ledger, { dailyLimitUsd: 10, monthlyLimitUsd: 100 });

  const cloud = makeProfile({ provider: "openai", model: "gpt-5-mini", tier: "economy" });
  const local = makeProfile({ provider: "ollama", model: "llama3.1", tier: "economy", estCostPerTaskUsd: 0, dataResidency: "local_only" });
  const policy = makePolicy({ taskClassId: "clasificacion", candidateTiers: [[cloud, local]] });

  const decision = await router.route(baseRouteRequest("clasificacion"), policy, { timeoutMs: 1000 });

  assert.equal(decision.chosen?.provider, "ollama");
  assert.equal(decision.attempts[0]?.outcome, "FAILED");
  assert.equal(decision.attempts[1]?.outcome, "SUCCEEDED");
  assert.equal(transport.requests.length, 2);
});

test("router: requiresLocalOnly salta proveedores no locales aunque tengan mejor calidad", async () => {
  const transport = new FakeTransport([
    { kind: "respond", status: 200, body: { message: { role: "assistant", content: "solo local" }, done: true, prompt_eval_count: 1, eval_count: 1 } },
  ]);
  const gateway = new AiGateway([createOpenAiAdapter(), createOllamaAdapter()], transport);
  const ledger = new InMemoryBudgetLedger(FIXED_CLOCK);
  const router = new ModelRouter(gateway, ledger, { dailyLimitUsd: 10, monthlyLimitUsd: 100 });

  const cloud = makeProfile({ provider: "openai", model: "gpt-5", tier: "premium", qualityScore: 0.99 });
  const local = makeProfile({ provider: "ollama", model: "llama3.1", tier: "economy", qualityScore: 0.6, dataResidency: "local_only", estCostPerTaskUsd: 0 });
  const policy = makePolicy({ taskClassId: "dato-sensible", requiresLocalOnly: true, minQualityScore: 0, candidateTiers: [[cloud, local]] });

  const decision = await router.route(baseRouteRequest("dato-sensible"), policy, { timeoutMs: 1000 });

  assert.equal(decision.attempts[0]?.outcome, "SKIPPED_RESIDENCY");
  assert.equal(decision.chosen?.provider, "ollama");
  assert.equal(transport.requests.length, 1, "solo debe llamar al proveedor local");
});
