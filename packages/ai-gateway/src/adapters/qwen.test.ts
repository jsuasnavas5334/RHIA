import { test } from "node:test";
import assert from "node:assert/strict";
import { createQwenAdapter } from "./qwen.js";
import { FakeTransport } from "../testing/fake-transport.js";
import { makeRequest } from "../testing/fixtures.js";

test("qwen: normaliza respuesta con el mismo contrato que openai (modo DashScope compatible)", async () => {
  const adapter = createQwenAdapter();
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: {
        choices: [{ message: { role: "assistant", content: "hola desde qwen" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      },
    },
  ]);
  const controller = new AbortController();
  const result = await adapter.invoke(makeRequest("qwen", "qwen-plus"), transport, controller.signal);

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.status === "SUCCEEDED" && result.provider, "qwen");
  assert.match(transport.requests[0]?.url ?? "", /dashscope.*\/chat\/completions$/);
});
