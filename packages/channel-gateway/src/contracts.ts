// Contratos neutrales del Channel Gateway (PH08-T001).
// Ningun campo aqui depende de un proveedor concreto: los adapters
// traducen desde/hacia este contrato, nunca al reves (mismo principio que
// @rhia/ai-gateway/contracts.ts, PH05-T002).
//
// "Email provider configurable" y el resto de canales de la seccion
// "Comunicacion" del catalogo de herramientas (PLAN_MAESTRO.md) se
// resuelven aqui como adapters intercambiables por canal, nunca como SDKs
// de proveedor incrustados en este paquete.

export type ChannelId = "email" | "whatsapp" | "linkedin" | "form" | "chat" | "social";

export type ChannelDeliveryStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "BOUNCED"
  | "FAILED";

/**
 * Peticion de envio saliente. `idempotencyKey` es obligatorio y debe ser
 * estable por intento logico de negocio (p.ej. el id de un outreach_touch),
 * nunca generado de nuevo en cada retry -- ese es justamente el mecanismo
 * que permite "Retry no duplica" (criterio de aceptacion de PH08-T001).
 */
export interface ChannelSendRequest {
  readonly idempotencyKey: string;
  readonly organizationId: string;
  readonly channel: ChannelId;
  readonly provider: string;
  readonly to: string;
  readonly subject: string | null;
  readonly body: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ChannelSendSuccess {
  readonly status: "SUCCEEDED";
  readonly requestId: string;
  readonly channel: ChannelId;
  readonly provider: string;
  readonly providerMessageId: string;
  readonly deliveryStatus: ChannelDeliveryStatus;
  readonly deduplicated: boolean;
  readonly latencyMs: number;
}

export interface ChannelSendFailure {
  readonly status: "FAILED";
  readonly requestId: string;
  readonly channel: ChannelId;
  readonly provider: string;
  readonly error: ChannelError;
  readonly latencyMs: number;
}

export type ChannelSendResult = ChannelSendSuccess | ChannelSendFailure;

export type ChannelErrorCode =
  | "RHIA_CHANNEL_INVALID_REQUEST"
  | "RHIA_CHANNEL_IDEMPOTENCY_CONFLICT"
  | "RHIA_CHANNEL_AUTH_FAILED"
  | "RHIA_CHANNEL_RATE_LIMITED"
  | "RHIA_CHANNEL_TIMEOUT"
  | "RHIA_CHANNEL_CANCELLED"
  | "RHIA_CHANNEL_PROVIDER_UNAVAILABLE"
  | "RHIA_CHANNEL_UNSUPPORTED"
  | "RHIA_CHANNEL_REJECTED"
  | "RHIA_CHANNEL_UNEXPECTED_FAILURE";

export interface ChannelErrorCause {
  readonly provider: string;
  readonly originalCode: string;
}

export interface ChannelError {
  readonly code: ChannelErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly safeDetails: string;
  readonly cause: ChannelErrorCause | null;
}

/**
 * Evento de callback/webhook entrante de un proveedor (delivery status,
 * bounce, read receipt, etc.). `providerEventId` es lo que el proveedor usa
 * para identificar el evento (no el mensaje) y es la clave de dedupe para
 * "Webhook duplicate" -- un mismo evento puede llegar mas de una vez por
 * reintentos del proveedor y no debe procesarse dos veces.
 */
export interface ChannelWebhookEvent {
  readonly provider: string;
  readonly providerEventId: string;
  readonly providerMessageId: string;
  readonly deliveryStatus: ChannelDeliveryStatus;
  readonly occurredAt: string;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface ChannelWebhookResult {
  readonly outcome: "PROCESSED" | "DUPLICATE_IGNORED";
  readonly event: ChannelWebhookEvent;
}
