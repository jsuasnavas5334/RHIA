// Helper compartido por los adapters que hablan el dialecto "OpenAI Chat
// Completions" (OpenAI, DeepSeek y Qwen/DashScope modo compatible). No es
// logica de negocio: es solo la traduccion mecanica de forma de mensaje.
// Cada adapter concreto sigue siendo un archivo propio con su capabilities
// y su base URL; este modulo no decide nada por si mismo.

import type {
  GatewayContentPart,
  GatewayError,
  GatewayFinishReason,
  GatewayMessage,
  GatewayRequest,
  GatewayResult,
  GatewayRole,
  ProviderId,
} from "../contracts.js";
import { createGatewayError, isAbortError, normalizeUnexpectedError } from "../errors.js";
import type { Transport, TransportRequest } from "../transport.js";

export interface ProviderConnectionConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
}

export interface OpenAiCompatiblePricing {
  readonly inputPerMillionUsd: number;
  readonly outputPerMillionUsd: number;
}

interface OpenAiChatMessage {
  readonly role: string;
  readonly content: string | null;
  readonly tool_call_id?: string;
  readonly tool_calls?: ReadonlyArray<{
    readonly id: string;
    readonly type: "function";
    readonly function: { readonly name: string; readonly arguments: string };
  }>;
}

function partsToText(parts: readonly GatewayContentPart[]): string {
  return parts
    .filter((part): part is Extract<GatewayContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function toOpenAiRole(role: GatewayRole): string {
  return role;
}

function toOpenAiMessage(message: GatewayMessage): OpenAiChatMessage {
  const toolCalls = message.content.filter(
    (part): part is Extract<GatewayContentPart, { type: "tool_call" }> => part.type === "tool_call",
  );
  const toolResult = message.content.find(
    (part): part is Extract<GatewayContentPart, { type: "tool_result" }> => part.type === "tool_result",
  );

  if (message.role === "tool" && toolResult !== undefined) {
    return {
      role: "tool",
      content: JSON.stringify(toolResult.result),
      tool_call_id: toolResult.toolCallId,
    };
  }

  if (toolCalls.length > 0) {
    return {
      role: toOpenAiRole(message.role),
      content: partsToText(message.content) || null,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      })),
    };
  }

  return { role: toOpenAiRole(message.role), content: partsToText(message.content) };
}

function buildRequestBody(request: GatewayRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages.map(toOpenAiMessage),
    max_tokens: request.maxOutputTokens,
    temperature: request.temperature,
  };
  if (request.tools.length > 0) {
    body["tools"] = request.tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.parametersSchema },
    }));
  }
  if (request.responseFormat.kind === "json") {
    body["response_format"] = { type: "json_object" };
  }
  return body;
}

function mapFinishReason(reason: string): GatewayFinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "tool_calls":
      return "tool_call";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    default:
      return "stop";
  }
}

function estimateCost(
  pricing: OpenAiCompatiblePricing,
  inputTokens: number,
  outputTokens: number,
): { readonly currency: "USD"; readonly amount: number; readonly isEstimate: true } {
  const amount =
    (inputTokens / 1_000_000) * pricing.inputPerMillionUsd +
    (outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
  return { currency: "USD", amount: Math.round(amount * 1_000_000) / 1_000_000, isEstimate: true };
}

function classifyHttpError(providerId: ProviderId, status: number, bodyText: string): GatewayError {
  const safeDetails = bodyText.slice(0, 200);
  if (status === 401 || status === 403) {
    return createGatewayError({
      code: "RHIA_AI_AUTH_FAILED",
      message: "El proveedor rechazo las credenciales.",
      safeDetails,
      providerId,
      originalCode: String(status),
    });
  }
  if (status === 429) {
    return createGatewayError({
      code: "RHIA_AI_RATE_LIMITED",
      message: "El proveedor aplico rate limit.",
      safeDetails,
      providerId,
      originalCode: String(status),
    });
  }
  if (status === 400 || status === 422) {
    return createGatewayError({
      code: "RHIA_AI_INVALID_REQUEST",
      message: "El proveedor rechazo la solicitud por invalida.",
      safeDetails,
      providerId,
      originalCode: String(status),
    });
  }
  if (status >= 500) {
    return createGatewayError({
      code: "RHIA_AI_PROVIDER_UNAVAILABLE",
      message: "El proveedor respondio con error de servidor.",
      safeDetails,
      providerId,
      originalCode: String(status),
    });
  }
  return createGatewayError({
    code: "RHIA_AI_UNEXPECTED_FAILURE",
    message: `El proveedor respondio con estado inesperado ${status}.`,
    safeDetails,
    providerId,
    originalCode: String(status),
  });
}

export async function invokeOpenAiCompatible(
  providerId: ProviderId,
  config: ProviderConnectionConfig,
  pricing: OpenAiCompatiblePricing,
  request: GatewayRequest,
  transport: Transport,
  signal: AbortSignal,
): Promise<GatewayResult> {
  const startedAt = Date.now();
  const transportRequest: TransportRequest = {
    url: `${config.baseUrl}/chat/completions`,
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(buildRequestBody(request)),
    signal,
  };

  try {
    const response = await transport.send(transportRequest);
    const latencyMs = Date.now() - startedAt;

    if (response.status < 200 || response.status >= 300) {
      return {
        status: "FAILED",
        requestId: request.requestId,
        provider: providerId,
        model: request.model,
        error: classifyHttpError(providerId, response.status, response.bodyText),
        latencyMs,
      };
    }

    const parsed = JSON.parse(response.bodyText) as {
      choices: ReadonlyArray<{
        message: { role: string; content: string | null; tool_calls?: OpenAiChatMessage["tool_calls"] };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const choice = parsed.choices[0];
    if (choice === undefined) {
      return {
        status: "FAILED",
        requestId: request.requestId,
        provider: providerId,
        model: request.model,
        error: createGatewayError({
          code: "RHIA_AI_UNEXPECTED_FAILURE",
          message: "El proveedor no devolvio ninguna respuesta (choices vacio).",
          providerId,
          originalCode: "EMPTY_CHOICES",
        }),
        latencyMs,
      };
    }

    const contentParts: GatewayContentPart[] = [];
    if (choice.message.content !== null && choice.message.content !== "") {
      contentParts.push({ type: "text", text: choice.message.content });
    }
    for (const call of choice.message.tool_calls ?? []) {
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(call.function.arguments);
      } catch {
        parsedArgs = call.function.arguments;
      }
      contentParts.push({ type: "tool_call", id: call.id, name: call.function.name, arguments: parsedArgs });
    }

    const usage = parsed.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      status: "SUCCEEDED",
      requestId: request.requestId,
      provider: providerId,
      model: request.model,
      message: { role: "assistant", content: contentParts },
      finishReason: mapFinishReason(choice.finish_reason),
      usage: {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      cost: estimateCost(pricing, usage.prompt_tokens, usage.completion_tokens),
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    if (isAbortError(error)) {
      return {
        status: "FAILED",
        requestId: request.requestId,
        provider: providerId,
        model: request.model,
        error: createGatewayError({
          code: "RHIA_AI_TIMEOUT",
          message: "La solicitud se cancelo por timeout o cancelacion explicita.",
          providerId,
          originalCode: "ABORTED",
        }),
        latencyMs,
      };
    }
    return {
      status: "FAILED",
      requestId: request.requestId,
      provider: providerId,
      model: request.model,
      error: normalizeUnexpectedError(providerId, error),
      latencyMs,
    };
  }
}
