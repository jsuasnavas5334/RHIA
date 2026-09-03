import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnthropicAdapter } from "./anthropic.js";
import { FakeTransport } from "../testing/fake-transport.js";
import { makeRequest } from "../testing/fixtures.js";

test("anthropic: normaliza respuesta de texto y usage", async () => {
  const adapter = createAnthropicAdapter();
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: {
        content: [{ type: "text", text: "hola desde claude" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 12, output_tokens: 6 },
      },
    },
  ]);
  const controller = new AbortController();
  const result = await adapter.invoke(makeRequest("anthropic", "claude-x"), transport, controller.signal);

  assert.equal(result.status, "SUCCEEDED");
  if (result.status !== "SUCCEEDED") throw new Error("unreachable");
  assert.equal(result.finishReason, "stop");
  assert.equal(result.usage.totalTokens, 18);
  assert.match(transport.requests[0]?.url ?? "", /\/messages$/);
  assert.equal(transport.requests[0]?.headers["x-api-key"], "");
});

test("anthropic: normaliza tool_use a GatewayToolCallPart y stop_reason tool_use a tool_call", async () => {
  const adapter = createAnthropicAdapter();
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: {
        content: [{ type: "tool_use", id: "toolu_1", name: "buscar_empresa", input: { nombre: "Acme" } }],
        stop_reason: "tool_use",
        usage: { input_tokens: 20, output_tokens: 4 },
      },
    },
  ]);
  const request = makeRequest("anthropic", "claude-x", {
    tools: [{ name: "buscar_empresa", description: "Busca una empresa", parametersSchema: { type: "object" } }],
  });
  const controller = new AbortController();
  const result = await adapter.invoke(request, transport, controller.signal);

  assert.equal(result.status, "SUCCEEDED");
  if (result.status !== "SUCCEEDED") throw new Error("unreachable");
  assert.equal(result.finishReason, "tool_call");
  const part = result.message.content[0];
  assert.equal(part?.type, "tool_call");
  assert.deepEqual(part?.type === "tool_call" ? part.arguments : undefined, { nombre: "Acme" });
});

test("anthropic: el system message se extrae al campo system, no a messages", async () => {
  const adapter = createAnthropicAdapter();
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } },
    },
  ]);
  const request = makeRequest("anthropic", "claude-x", {
    messages: [
      { role: "system", content: [{ type: "text", text: "Eres un asistente de RHIA." }] },
      { role: "user", content: [{ type: "text", text: "hola" }] },
    ],
  });
  const controller = new AbortController();
  await adapter.invoke(request, transport, controller.signal);

  const body = JSON.parse(transport.requests[0]?.body ?? "{}") as { system?: string; messages: unknown[] };
  assert.equal(body.system, "Eres un asistente de RHIA.");
  assert.equal(body.messages.length, 1);
});
