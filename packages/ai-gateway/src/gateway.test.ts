import { test } from "node:test";
import assert from "node:assert/strict";
import { AiGateway } from "./gateway.js";
import { createOpenAiAdapter } from "./adapters/openai.js";
import { createAnthropicAdapter } from "./adapters/anthropic.js";
import { createOllamaAdapter } from "./adapters/ollama.js";
import { FakeTransport } from "./testing/fake-transport.js";
import { makeRequest } from "./testing/fixtures.js";

test("gateway: timeout aborta la solicitud y devuelve RHIA_AI_TIMEOUT", async () => {
  const transport = new FakeTransport([{ kind: "hang" }]);
  const gateway = new AiGateway([createOpenAiAdapter()], transport);

  const result = await gateway.invoke(makeRequest("openai", "gpt-5"), { timeoutMs: 20 });

  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.equal(result.error.code, "RHIA_AI_TIMEOUT");
    assert.equal(result.error.retryable, true);
  }
});

test("gateway: outage de proveedor (500) se normaliza como RHIA_AI_PROVIDER_UNAVAILABLE, retryable", async () => {
  const transport = new FakeTransport([{ kind: "respond", status: 503, body: { error: "unavailable" } }]);
  const gateway = new AiGateway([createOpenAiAdapter()], transport);

  const result = await gateway.invoke(makeRequest("openai", "gpt-5"), { timeoutMs: 1000 });

  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.equal(result.error.code, "RHIA_AI_PROVIDER_UNAVAILABLE");
    assert.equal(result.error.retryable, true);
  }
});

test("gateway: fallback mecanico pasa al segundo candidato cuando el primero falla, sin duplicar exito", async () => {
  const transport = new FakeTransport([
    { kind: "throw", message: "network down" },
    {
      kind: "respond",
      status: 200,
      body: {
        content: [{ type: "text", text: "respuesta del segundo candidato" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 3, output_tokens: 2 },
      },
    },
  ]);
  const gateway = new AiGateway([createOpenAiAdapter(), createAnthropicAdapter()], transport);

  const result = await gateway.invokeWithFallback(
    [makeRequest("openai", "gpt-5", { requestId: "req-fb" }), makeRequest("anthropic", "claude-x", { requestId: "req-fb" })],
    { timeoutMs: 1000 },
  );

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.status === "SUCCEEDED" && result.provider, "anthropic");
  assert.equal(transport.requests.length, 2);
});

test("gateway: si todos los candidatos fallan, agrega RHIA_AI_ALL_CANDIDATES_FAILED", async () => {
  const transport = new FakeTransport([
    { kind: "respond", status: 500, body: { error: "down" } },
    { kind: "respond", status: 500, body: { error: "down" } },
  ]);
  const gateway = new AiGateway([createOpenAiAdapter(), createAnthropicAdapter()], transport);

  const result = await gateway.invokeWithFallback(
    [makeRequest("openai", "gpt-5"), makeRequest("anthropic", "claude-x")],
    { timeoutMs: 1000 },
  );

  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.equal(result.error.code, "RHIA_AI_ALL_CANDIDATES_FAILED");
  }
  assert.equal(transport.requests.length, 2);
});

test("gateway: bloquea tools contra un proveedor sin esa capability antes de llamar al transporte", async () => {
  const transport = new FakeTransport([]);
  const gateway = new AiGateway([createOllamaAdapter()], transport);

  const request = makeRequest("ollama", "llama3.1", {
    tools: [{ name: "buscar_empresa", description: "x", parametersSchema: { type: "object" } }],
  });
  const result = await gateway.invoke(request, { timeoutMs: 1000 });

  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") assert.equal(result.error.code, "RHIA_AI_UNSUPPORTED_CAPABILITY");
  assert.equal(transport.requests.length, 0);
});

// Validacion final del packet PH05-T002: "una task de prueba corre con al
// menos 3 providers sin cambiar codigo de dominio". La funcion
// `runDomainTask` de abajo representa ese codigo de dominio: no sabe nada
// de OpenAI/Anthropic/Ollama, solo habla el contrato neutral.
function runDomainTask(status: string, textIfSucceeded: string | undefined): { handled: boolean; text?: string } {
  if (status === "SUCCEEDED" && textIfSucceeded !== undefined) {
    return { handled: true, text: textIfSucceeded };
  }
  return { handled: false };
}

test("validacion final PH05-T002: la misma tarea corre sin cambios sobre openai, anthropic y ollama", async () => {
  const results: Array<{ handled: boolean; text?: string }> = [];

  {
    const transport = new FakeTransport([
      {
        kind: "respond",
        status: 200,
        body: {
          choices: [{ message: { role: "assistant", content: "hola" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
      },
    ]);
    const gateway = new AiGateway([createOpenAiAdapter()], transport);
    const result = await gateway.invoke(makeRequest("openai", "gpt-5"), { timeoutMs: 1000 });
    results.push(runDomainTask(result.status, result.status === "SUCCEEDED" ? result.message.content[0]?.type === "text" ? result.message.content[0].text : undefined : undefined));
  }

  {
    const transport = new FakeTransport([
      {
        kind: "respond",
        status: 200,
        body: { content: [{ type: "text", text: "hola" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } },
      },
    ]);
    const gateway = new AiGateway([createAnthropicAdapter()], transport);
    const result = await gateway.invoke(makeRequest("anthropic", "claude-x"), { timeoutMs: 1000 });
    results.push(runDomainTask(result.status, result.status === "SUCCEEDED" ? result.message.content[0]?.type === "text" ? result.message.content[0].text : undefined : undefined));
  }

  {
    const transport = new FakeTransport([
      { kind: "respond", status: 200, body: { message: { role: "assistant", content: "hola" }, done: true, prompt_eval_count: 1, eval_count: 1 } },
    ]);
    const gateway = new AiGateway([createOllamaAdapter()], transport);
    const result = await gateway.invoke(makeRequest("ollama", "llama3.1"), { timeoutMs: 1000 });
    results.push(runDomainTask(result.status, result.status === "SUCCEEDED" ? result.message.content[0]?.type === "text" ? result.message.content[0].text : undefined : undefined));
  }

  assert.equal(results.length, 3);
  for (const r of results) {
    assert.equal(r.handled, true);
    assert.equal(r.text, "hola");
  }
});
