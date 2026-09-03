import type {
  GatewayCapabilities,
  GatewayContentPart,
  GatewayFinishReason,
  GatewayMessage,
  GatewayRequest,
  GatewayResult,
} from "../contracts.js";
import { createGatewayError, isAbortError, normalizeUnexpectedError } from "../errors.js";
import type { Transport, TransportRequest } from "../transport.js";
import type { ProviderAdapter } from "./types.js";
import type { ProviderConnectionConfig } from "./shared-openai-compatible.js";

const CAPABILITIES: GatewayCapabilities = {
  supportsTools: true,
  supportsJsonMode: false, // Anthropic no tiene un "json_object" nativo; se logra con tool-forcing, fuera de alcance aqui.
  supportsStreaming: true,
  supportsVision: true,
  maxContextTokens: 200_000,
};

const PRICING = { inputPerMillionUsd: 3, outputPerMillionUsd: 15 };

const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicContentBlock {
  readonly type: "text" | "tool_use" | "tool_result";
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: unknown;
  readonly tool_use_id?: string;
  readonly content?: string;
}

interface AnthropicMessage {
  readonly role: "user" | "assistant";
  readonly content: AnthropicContentBlock[];
}

function extractSystemPrompt(messages: readonly GatewayMessage[]): string | undefined {
  const systemMessages = messages.filter((m) => m.role === "system");
  if (systemMessages.length === 0) return undefined;
  return systemMessages
    .map((m) => m.content.filter((p): p is Extract<GatewayContentPart, { type: "text" }> => p.type === "text").map((p) => p.text).join("\n"))
    .join("\n");
}

function toAnthropicMessages(messages: readonly GatewayMessage[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    const role: "user" | "assistant" = message.role === "assistant" ? "assistant" : "user";
    const blocks: AnthropicContentBlock[] = [];
    for (const part of message.content) {
      if (part.type === "text") {
        blocks.push({ type: "text", text: part.text });
      } else if (part.type === "tool_call") {
        blocks.push({ type: "tool_use", id: part.id, name: part.name, input: part.arguments });
      } else if (part.type === "tool_result") {
        blocks.push({ type: "tool_result", tool_use_id: part.toolCallId, content: JSON.stringify(part.result) });
      }
    }
    result.push({ role, content: blocks });
  }
  return result;
}

function buildRequestBody(request: GatewayRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: toAnthropicMessages(request.messages),
    max_tokens: request.maxOutputTokens,
    temperature: request.temperature,
  };
  const system = extractSystemPrompt(request.messages);
  if (system !== undefined) body["system"] = system;
  if (request.tools.length > 0) {
    body["tools"] = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parametersSchema,
    }));
  }
  return body;
}

function mapStopReason(reason: string): GatewayFinishReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "tool_call";
    case "max_tokens":
      return "length";
    default:
      return "stop";
  }
}

export function createAnthropicAdapter(
  config: ProviderConnectionConfig = { baseUrl: "https://api.anthropic.com/v1", apiKey: "" },
): ProviderAdapter {
  return {
    providerId: "anthropic",
    capabilities: CAPABILITIES,
    async invoke(request: GatewayRequest, transport: Transport, signal: AbortSignal): Promise<GatewayResult> {
      const startedAt = Date.now();
      const transportRequest: TransportRequest = {
        url: `${config.baseUrl}/messages`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(buildRequestBody(request)),
        signal,
      };

      try {
        const response = await transport.send(transportRequest);
        const latencyMs = Date.now() - startedAt;

        if (response.status < 200 || response.status >= 300) {
          const safeDetails = response.bodyText.slice(0, 200);
          const code =
            response.status === 401 || response.status === 403
              ? "RHIA_AI_AUTH_FAILED"
              : response.status === 429
                ? "RHIA_AI_RATE_LIMITED"
                : response.status === 400
                  ? "RHIA_AI_INVALID_REQUEST"
                  : response.status >= 500
                    ? "RHIA_AI_PROVIDER_UNAVAILABLE"
                    : "RHIA_AI_UNEXPECTED_FAILURE";
          return {
            status: "FAILED",
            requestId: request.requestId,
            provider: "anthropic",
            model: request.model,
            error: createGatewayError({
              code,
              message: "El proveedor respondio con error HTTP.",
              safeDetails,
              providerId: "anthropic",
              originalCode: String(response.status),
            }),
            latencyMs,
          };
        }

        const parsed = JSON.parse(response.bodyText) as {
          content: AnthropicContentBlock[];
          stop_reason: string;
          usage: { input_tokens: number; output_tokens: number };
        };

        const contentParts: GatewayContentPart[] = parsed.content.map((block): GatewayContentPart => {
          if (block.type === "tool_use") {
            return { type: "tool_call", id: block.id ?? "", name: block.name ?? "", arguments: block.input };
          }
          return { type: "text", text: block.text ?? "" };
        });

        return {
          status: "SUCCEEDED",
          requestId: request.requestId,
          provider: "anthropic",
          model: request.model,
          message: { role: "assistant", content: contentParts },
          finishReason: mapStopReason(parsed.stop_reason),
          usage: {
            inputTokens: parsed.usage.input_tokens,
            outputTokens: parsed.usage.output_tokens,
            totalTokens: parsed.usage.input_tokens + parsed.usage.output_tokens,
          },
          cost: {
            currency: "USD",
            amount:
              Math.round(
                ((parsed.usage.input_tokens / 1_000_000) * PRICING.inputPerMillionUsd +
                  (parsed.usage.output_tokens / 1_000_000) * PRICING.outputPerMillionUsd) *
                  1_000_000,
              ) / 1_000_000,
            isEstimate: true,
          },
          latencyMs,
        };
      } catch (error) {
        const latencyMs = Date.now() - startedAt;
        if (isAbortError(error)) {
          return {
            status: "FAILED",
            requestId: request.requestId,
            provider: "anthropic",
            model: request.model,
            error: createGatewayError({
              code: "RHIA_AI_TIMEOUT",
              message: "La solicitud se cancelo por timeout o cancelacion explicita.",
              providerId: "anthropic",
              originalCode: "ABORTED",
            }),
            latencyMs,
          };
        }
        return {
          status: "FAILED",
          requestId: request.requestId,
          provider: "anthropic",
          model: request.model,
          error: normalizeUnexpectedError("anthropic", error),
          latencyMs,
        };
      }
    },
  };
}
