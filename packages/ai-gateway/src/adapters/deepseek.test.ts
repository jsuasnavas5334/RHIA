import { test } from "node:test";
import assert from "node:assert/strict";
import { createDeepSeekAdapter } from "./deepseek.js";
import { FakeTransport } from "../testing/fake-transport.js";
import { makeRequest } from "../testing/fixtures.js";

test("deepseek: normaliza respuesta con el mismo contrato que openai (dialecto compatible)", async () => {
  const adapter = createDeepSeekAdapter();
  const transport = new FakeTransport([
    {
      kind: "respond",
      status: 200,
      body: {
        choices: [{ message: { role: "assistant", content: "hola desde deepseek" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      },
    },
  ]);
  const controller = new AbortController();
  const result = await adapter.invoke(makeRequest("deepseek", "deepseek-chat"), transport, controller.signal);

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.status === "SUCCEEDED" && result.provider, "deepseek");
  assert.match(transport.requests[0]?.url ?? "", /deepseek\.com.*\/chat\/completions$/);
});
