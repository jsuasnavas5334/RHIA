export type {
  ChannelId,
  ChannelDeliveryStatus,
  ChannelSendRequest,
  ChannelSendSuccess,
  ChannelSendFailure,
  ChannelSendResult,
  ChannelErrorCode,
  ChannelErrorCause,
  ChannelError,
  ChannelWebhookEvent,
  ChannelWebhookResult,
} from "./contracts.js";

export { createChannelError, normalizeUnexpectedError, isRetryableCode, isAbortError } from "./errors.js";

export type { Transport, TransportRequest, TransportResponse } from "./transport.js";
export { FetchTransport } from "./transport.js";

export type {
  IdempotencyKeyInput,
  IdempotencyLookup,
  IdempotencyRecordInput,
  IdempotencyStore,
} from "./idempotency.js";
export { computeSendFingerprint, stableFingerprint, InMemoryIdempotencyStore } from "./idempotency.js";

export type { ChannelProviderAdapter, ChannelProviderCapabilities } from "./adapters/types.js";
export { createN8nWebhookAdapter } from "./adapters/n8n-webhook.js";
export type { N8nWebhookAdapterConfig } from "./adapters/n8n-webhook.js";

export { ChannelGateway } from "./gateway.js";
export type { ChannelGatewaySendOptions } from "./gateway.js";

export { FakeTransport } from "./testing/fake-transport.js";
export type { FakeTransportBehavior } from "./testing/fake-transport.js";
