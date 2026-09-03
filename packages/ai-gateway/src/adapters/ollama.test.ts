import { test } from "node:test";
import assert from "node:assert/strict";
import { createOllamaAdapter } from "./ollama.js";
import { FakeTransport } from "../testing/fake-transport.js";
import { makeRequest } from "../testing/fixtures.js";

test("ollama: normaliza respuesta local y marca costo real 0 (no estimado)", async () => {
  const adapter = createOllamaAdapter();
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: { message: { role: "assistant", content: "hola local" }, done: true, prompt_eval_count: 7, eval_count: 3 },
    },
  ]);
  const controller = new AbortController();
  const result = await adapter.invoke(makeRequest("ollama", "llama3.1"), transport, controller.signal);

  assert.equal(result.status, "SUCCEEDED");
  if (result.status !== "SUCCEEDED") throw new Error("unreachable");
  assert.equal(result.cost.amount, 0);
  assert.equal(result.cost.isEstimate, false);
  assert.equal(result.usage.totalTokens, 10);
});

test("ollama: rechaza tool calling en vez de fingir soporte (RHIA_AI_UNSUPPORTED_CAPABILITY)", async () => {
  const adapter = createOllamaAdapter();
  const transport = new FakeTransport([]); // no debe llegar a usarse
  const request = makeRequest("ollama", "llama3.1", {
    tools: [{ name: "buscar_empresa", description: "x", parametersSchema: { type: "object" } }],
  });
  const controller = new AbortController();
  const result = await adapter.invoke(request, transport, controller.signal);

  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.equal(result.error.code, "RHIA_AI_UNSUPPORTED_CAPABILITY");
  }
  assert.equal(transport.requests.length, 0, "no debe llamar al transporte si la capability no existe");
});
