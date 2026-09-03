import { FakeTransport } from "@rhia/ai-gateway";
import type { FakeTransportBehavior, GatewayFinishReason, ProviderId } from "@rhia/ai-gateway";

/**
 * Respuesta guionada para un candidato en un caso concreto. El harness NUNCA
 * llama a un proveedor real ni consume secretos: siempre construye un
 * FakeTransport de un solo uso con esta respuesta, respetando la restriccion
 * de "adapters con fakes/sandboxes, transporte inyectable" del ciclo.
 */
export interface ScriptedAnswer {
  readonly text: string;
  readonly finishReason: GatewayFinishReason;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Latencia simulada fija (determinista) para diferenciar candidatos en el reporte. */
  readonly delayMs: number;
}

function openAiFinishReason(reason: GatewayFinishReason): string {
  switch (reason) {
    case "stop":
      return "stop";
    case "tool_call":
      return "tool_calls";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
  }
}

function buildOpenAiCompatibleBody(answer: ScriptedAnswer): unknown {
  return {
    choices: [
      {
        message: { role: "assistant", content: answer.text },
        finish_reason: openAiFinishReason(answer.finishReason),
      },
    ],
    usage: {
      prompt_tokens: answer.inputTokens,
      completion_tokens: answer.outputTokens,
      total_tokens: answer.inputTokens + answer.outputTokens,
    },
  };
}

function anthropicStopReason(reason: GatewayFinishReason): string {
  switch (reason) {
    case "stop":
      return "end_turn";
    case "tool_call":
      return "tool_use";
    case "length":
      return "max_tokens";
    case "content_filter":
      return "end_turn";
  }
}

function buildAnthropicBody(answer: ScriptedAnswer): unknown {
  return {
    content: [{ type: "text", text: answer.text }],
    stop_reason: anthropicStopReason(answer.finishReason),
    usage: { input_tokens: answer.inputTokens, output_tokens: answer.outputTokens },
  };
}

function buildOllamaBody(answer: ScriptedAnswer): unknown {
  return {
    message: { role: "assistant", content: answer.text },
    done: true,
    prompt_eval_count: answer.inputTokens,
    eval_count: answer.outputTokens,
  };
}

/** Construye el body de red exacto que cada adapter real espera parsear. */
export function buildResponseBody(provider: ProviderId, answer: ScriptedAnswer): unknown {
  switch (provider) {
    case "openai":
    case "deepseek":
    case "qwen":
      return buildOpenAiCompatibleBody(answer);
    case "anthropic":
      return buildAnthropicBody(answer);
    case "ollama":
      return buildOllamaBody(answer);
  }
}

export function buildFakeTransportFor(provider: ProviderId, answer: ScriptedAnswer): FakeTransport {
  const behavior: FakeTransportBehavior = {
    kind: "respond",
    status: 200,
    body: buildResponseBody(provider, answer),
    delayMs: answer.delayMs,
  };
  return new FakeTransport([behavior]);
}
