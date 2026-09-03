import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpenAiAdapter } from "./openai.js";
import { FakeTransport } from "../testing/fake-transport.js";
import { makeRequest } from "../testing/fixtures.js";

test("openai: normaliza una respuesta de texto exitosa", async () => {
  const adapter = createOpenAiAdapter();
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: {
        choices: [{ message: { role: "assistant", content: "hola humano" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    },
  ]);
  const controller = new AbortController();
  const result = await adapter.invoke(makeRequest("openai", "gpt-5"), transport, controller.signal);

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.status === "SUCCEEDED" && result.message.content[0]?.type, "text");
  assert.equal(result.status === "SUCCEEDED" && result.usage.totalTokens, 15);
  assert.equal(result.status === "SUCCEEDED" && result.cost.isEstimate, true);
  assert.equal(transport.requests.length, 1);
  assert.match(transport.requests[0]?.url ?? "", /\/chat\/completions$/);
});

test("openai: normaliza tool_calls a GatewayToolCallPart", async () => {
  const adapter = createOpenAiAdapter();
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                { id: "call_1", type: "function", function: { name: "buscar_empresa", arguments: '{"nombre":"Acme"}' } },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
      },
    },
  ]);
  const request = makeRequest("openai", "gpt-5", {
    tools: [{ name: "buscar_empresa", description: "Busca una empresa", parametersSchema: { type: "object" } }],
  });
  const controller = new AbortController();
  const result = await adapter.invoke(request, transport, controller.signal);

  assert.equal(result.status, "SUCCEEDED");
  if (result.status !== "SUCCEEDED") throw new Error("unreachable");
  assert.equal(result.finishReason, "tool_call");
  const toolCall = result.message.content[0];
  assert.equal(toolCall?.type, "tool_call");
  assert.deepEqual(toolCall?.type === "tool_call" ? toolCall.arguments : undefined, { nombre: "Acme" });
});

test("openai: modo JSON estructurado se marca en el body y no rompe el parseo", async () => {
  const adapter = createOpenAiAdapter();
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: {
        choices: [{ message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      },
    },
  ]);
  const request = makeRequest("openai", "gpt-5", {
    responseFormat: { kind: "json", jsonSchema: { type: "object", properties: { ok: { type: "boolean" } } } },
  });
  const controller = new AbortController();
  await adapter.invoke(request, transport, controller.signal);

  const sentBody = JSON.parse(transport.requests[0]?.body ?? "{}") as { response_format?: { type: string } };
  assert.equal(sentBody.response_format?.type, "json_object");
});

test("openai: clasifica 401 como RHIA_AI_AUTH_FAILED y 429 como RHIA_AI_RATE_LIMITED", async () => {
  const adapter = createOpenAiAdapter();
  const transport = new FakeTransport([
    { kind: "respond", status: 401, body: { error: "invalid api key" } },
    { kind: "respond", status: 429, body: { error: "rate limited" } },
  ]);
  const controller = new AbortController();
  const request = makeRequest("openai", "gpt-5");

  const first = await adapter.invoke(request, transport, controller.signal);
  assert.equal(first.status, "FAILED");
  if (first.status === "FAILED") {
    assert.equal(first.error.code, "RHIA_AI_AUTH_FAILED");
    assert.equal(first.error.retryable, false);
  }

  const second = await adapter.invoke(request, transport, controller.signal);
  assert.equal(second.status, "FAILED");
  if (second.status === "FAILED") {
    assert.equal(second.error.code, "RHIA_AI_RATE_LIMITED");
    assert.equal(second.error.retryable, true);
  }
});
