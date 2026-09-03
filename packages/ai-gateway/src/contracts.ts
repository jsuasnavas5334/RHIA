// Contratos neutrales del AI Gateway (PH05-T002).
// Ningun campo aqui debe depender de un proveedor concreto: los adapters
// traducen desde/hacia este contrato, nunca al reves.

export type ProviderId = "openai" | "anthropic" | "deepseek" | "qwen" | "ollama";

export type GatewayRole = "system" | "user" | "assistant" | "tool";

export interface GatewayTextPart {
  readonly type: "text";
  readonly text: string;
}

export interface GatewayToolCallPart {
  readonly type: "tool_call";
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
}

export interface GatewayToolResultPart {
  readonly type: "tool_result";
  readonly toolCallId: string;
  readonly result: unknown;
  readonly isError: boolean;
}

export type GatewayContentPart = GatewayTextPart | GatewayToolCallPart | GatewayToolResultPart;

export interface GatewayMessage {
  readonly role: GatewayRole;
  readonly content: readonly GatewayContentPart[];
}

export interface GatewayToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parametersSchema: Readonly<Record<string, unknown>>;
}

export type GatewayResponseFormat =
  | { readonly kind: "text" }
  | { readonly kind: "json"; readonly jsonSchema: Readonly<Record<string, unknown>> };

export interface GatewayRequest {
  readonly requestId: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly messages: readonly GatewayMessage[];
  readonly tools: readonly GatewayToolDefinition[];
  readonly responseFormat: GatewayResponseFormat;
  readonly maxOutputTokens: number;
  readonly temperature: number;
}

export type GatewayFinishReason = "stop" | "tool_call" | "length" | "content_filter";

export interface GatewayUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface GatewayCost {
  readonly currency: "USD";
  readonly amount: number;
  readonly isEstimate: boolean;
}

export interface GatewayCapabilities {
  readonly supportsTools: boolean;
  readonly supportsJsonMode: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsVision: boolean;
  readonly maxContextTokens: number;
}

export interface GatewaySuccessResult {
  readonly status: "SUCCEEDED";
  readonly requestId: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly message: GatewayMessage;
  readonly finishReason: GatewayFinishReason;
  readonly usage: GatewayUsage;
  readonly cost: GatewayCost;
  readonly latencyMs: number;
}

export interface GatewayErrorResult {
  readonly status: "FAILED";
  readonly requestId: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly error: GatewayError;
  readonly latencyMs: number;
}

export type GatewayResult = GatewaySuccessResult | GatewayErrorResult;

export type GatewayErrorCode =
  | "RHIA_AI_INVALID_REQUEST"
  | "RHIA_AI_AUTH_FAILED"
  | "RHIA_AI_RATE_LIMITED"
  | "RHIA_AI_TIMEOUT"
  | "RHIA_AI_CANCELLED"
  | "RHIA_AI_PROVIDER_UNAVAILABLE"
  | "RHIA_AI_UNSUPPORTED_CAPABILITY"
  | "RHIA_AI_CONTENT_FILTERED"
  | "RHIA_AI_UNEXPECTED_FAILURE"
  | "RHIA_AI_ALL_CANDIDATES_FAILED";

export interface GatewayErrorCause {
  readonly providerId: ProviderId;
  readonly originalCode: string;
}

export interface GatewayError {
  readonly code: GatewayErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly safeDetails: string;
  readonly cause: GatewayErrorCause | null;
}
