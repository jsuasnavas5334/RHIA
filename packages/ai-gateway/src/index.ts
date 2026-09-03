export type {
  ProviderId,
  GatewayRole,
  GatewayTextPart,
  GatewayToolCallPart,
  GatewayToolResultPart,
  GatewayContentPart,
  GatewayMessage,
  GatewayToolDefinition,
  GatewayResponseFormat,
  GatewayRequest,
  GatewayFinishReason,
  GatewayUsage,
  GatewayCost,
  GatewayCapabilities,
  GatewaySuccessResult,
  GatewayErrorResult,
  GatewayResult,
  GatewayErrorCode,
  GatewayErrorCause,
  GatewayError,
} from "./contracts.js";

export { createGatewayError, normalizeUnexpectedError, isRetryableCode, isAbortError } from "./errors.js";

export type { Transport, TransportRequest, TransportResponse } from "./transport.js";
export { FetchTransport } from "./transport.js";

export type { ProviderAdapter } from "./adapters/types.js";
export type { ProviderConnectionConfig } from "./adapters/shared-openai-compatible.js";
export { createOpenAiAdapter } from "./adapters/openai.js";
export { createAnthropicAdapter } from "./adapters/anthropic.js";
export { createDeepSeekAdapter } from "./adapters/deepseek.js";
export { createQwenAdapter } from "./adapters/qwen.js";
export { createOllamaAdapter } from "./adapters/ollama.js";

export { AiGateway } from "./gateway.js";
export type { GatewayInvokeOptions } from "./gateway.js";

export { FakeTransport } from "./testing/fake-transport.js";
export type { FakeTransportBehavior } from "./testing/fake-transport.js";
