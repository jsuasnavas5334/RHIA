import type {
  GatewayCapabilities,
  GatewayContentPart,
  GatewayMessage,
  GatewayRequest,
  GatewayResult,
} from "../contracts.js";
import { createGatewayError, isAbortError, normalizeUnexpectedError } from "../errors.js";
import type { Transport, TransportRequest } from "../transport.js";
import type { ProviderAdapter } from "./types.js";
import type { ProviderConnectionConfig } from "./shared-openai-compatible.js";

// Ollama corre modelos locales. Deliberadamente NO declaramos soporte de
// tools ni vision: el runtime nativo /api/chat no expone tool calling de
// forma confiable en modelos genericos, y fingir el soporte violaria la
// regla del packet ("no fingir features no soportadas"). Si un modelo
// concreto soporta tools, este adapter puede evolucionar cuando haya
// evidencia real, no antes.
const CAPABILITIES: GatewayCapabilities = {
  supportsTools: false,
  supportsJsonMode: true,
  supportsStreaming: true,
  supportsVision: false,
  maxContextTokens: 8_192,
};

function partsToText(content: readonly GatewayContentPart[]): string {
  return content
    .filter((part): part is Extract<GatewayContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function toOllamaMessages(messages: readonly GatewayMessage[]): Array<{ role: string; content: string }> {
  return messages.map((message) => ({ role: message.role, content: partsToText(message.content) }));
}

export function createOllamaAdapter(
  config: ProviderConnectionConfig = { baseUrl: "http://127.0.0.1:11434/api", apiKey: "" },
): ProviderAdapter {
  return {
    providerId: "ollama",
    capabilities: CAPABILITIES,
    async invoke(request: GatewayRequest, transport: Transport, signal: AbortSignal): Promise<GatewayResult> {
      const startedAt = Date.now();

      if (request.tools.length > 0) {
        return {
          status: "FAILED",
          requestId: request.requestId,
          provider: "ollama",
          model: request.model,
          error: createGatewayError({
            code: "RHIA_AI_UNSUPPORTED_CAPABILITY",
            message: "El adapter de Ollama no soporta tool calling; no se envio la solicitud.",
            providerId: "ollama",
            originalCode: "TOOLS_UNSUPPORTED",
          }),
          latencyMs: Date.now() - startedAt,
        };
      }

      const body: Record<string, unknown> = {
        model: request.model,
        messages: toOllamaMessages(request.messages),
        stream: false,
        options: { temperature: request.temperature, num_predict: request.maxOutputTokens },
      };
      if (request.responseFormat.kind === "json") {
        body["format"] = "json";
      }

      const transportRequest: TransportRequest = {
        url: `${config.baseUrl}/chat`,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      };

      try {
        const response = await transport.send(transportRequest);
        const latencyMs = Date.now() - startedAt;

        if (response.status < 200 || response.status >= 300) {
          const safeDetails = response.bodyText.slice(0, 200);
          const code = response.status >= 500 ? "RHIA_AI_PROVIDER_UNAVAILABLE" : "RHIA_AI_INVALID_REQUEST";
          return {
            status: "FAILED",
            requestId: request.requestId,
            provider: "ollama",
            model: request.model,
            error: createGatewayError({
              code,
              message: "El servidor local de Ollama respondio con error.",
              safeDetails,
              providerId: "ollama",
              originalCode: String(response.status),
            }),
            latencyMs,
          };
        }

        const parsed = JSON.parse(response.bodyText) as {
          message: { role: string; content: string };
          done: boolean;
          prompt_eval_count?: number;
          eval_count?: number;
        };

        const inputTokens = parsed.prompt_eval_count ?? 0;
        const outputTokens = parsed.eval_count ?? 0;

        return {
          status: "SUCCEEDED",
          requestId: request.requestId,
          provider: "ollama",
          model: request.model,
          message: { role: "assistant", content: [{ type: "text", text: parsed.message.content }] },
          finishReason: "stop",
          usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
          // Ejecucion local: costo real es 0, no una estimacion.
          cost: { currency: "USD", amount: 0, isEstimate: false },
          latencyMs,
        };
      } catch (error) {
        const latencyMs = Date.now() - startedAt;
        if (isAbortError(error)) {
          return {
            status: "FAILED",
            requestId: request.requestId,
            provider: "ollama",
            model: request.model,
            error: createGatewayError({
              code: "RHIA_AI_TIMEOUT",
              message: "La solicitud se cancelo por timeout o cancelacion explicita.",
              providerId: "ollama",
              originalCode: "ABORTED",
            }),
            latencyMs,
          };
        }
        return {
          status: "FAILED",
          requestId: request.requestId,
          provider: "ollama",
          model: request.model,
          error: normalizeUnexpectedError("ollama", error),
          latencyMs,
        };
      }
    },
  };
}
