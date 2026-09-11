// Adapter de referencia: envia el mensaje via un webhook HTTP de n8n.
//
// Por que este es el primer adapter ("Implementar primero proveedores
// disponibles", accion 2 del Task Packet) y no un SDK de un proveedor de
// email/WhatsApp concreto: n8n ya es infraestructura real y operativa en
// este proyecto (ver PLAN_MAESTRO.md, "n8n conservado como orchestration
// layer", ADR-003) y es quien hoy tiene configurado el proveedor real de
// cada canal (email/WhatsApp Business API) del lado de sus propios
// workflows. Este adapter es agnostico de canal: n8n decide, dentro de su
// workflow, a que proveedor concreto enrutar segun `channel`. Cuando el
// negocio decida un proveedor de email/WhatsApp especifico para invocar
// directamente (sin pasar por n8n), se agrega como un adapter nuevo
// implementando la misma interfaz ChannelProviderAdapter -- no se modifica
// el Gateway ni los contratos.
//
// Contrato esperado del webhook de n8n (documentado aqui porque no existe
// aun un workflow real que lo implemente -- ese workflow es trabajo de
// integracion posterior, fuera de alcance de este paquete puro):
//   POST <webhookUrl>
//   body: { channel, provider: "n8n-webhook", to, subject, body, metadata,
//           idempotencyKey }
//   respuesta 2xx esperada: { providerMessageId: string, status?: string }
//   errores: 401/403 -> auth, 429 -> rate limit, 5xx o timeout -> proveedor
//   no disponible, cualquier otro 4xx -> peticion rechazada.

import type { ChannelDeliveryStatus, ChannelId, ChannelSendRequest, ChannelSendResult, ChannelWebhookEvent } from "../contracts.js";
import { createChannelError, isAbortError, normalizeUnexpectedError } from "../errors.js";
import type { Transport } from "../transport.js";
import type { ChannelProviderAdapter, ChannelProviderCapabilities } from "./types.js";

const PROVIDER_ID = "n8n-webhook";

const CAPABILITIES: ChannelProviderCapabilities = {
  supportsSubject: true,
  supportsAttachments: false,
  maxBodyLength: 20_000,
};

interface N8nAckBody {
  readonly providerMessageId?: unknown;
  readonly status?: unknown;
}

interface N8nWebhookEventBody {
  readonly providerEventId?: unknown;
  readonly providerMessageId?: unknown;
  readonly status?: unknown;
  readonly occurredAt?: unknown;
}

function normalizeStatus(raw: unknown): ChannelDeliveryStatus {
  const value = typeof raw === "string" ? raw.toUpperCase() : "";
  if (value === "SENT" || value === "DELIVERED" || value === "READ" || value === "BOUNCED" || value === "FAILED") {
    return value;
  }
  return "SENT";
}

function parseAckBody(bodyText: string): N8nAckBody {
  try {
    return JSON.parse(bodyText) as N8nAckBody;
  } catch {
    return {};
  }
}

export interface N8nWebhookAdapterConfig {
  readonly webhookUrl: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly channels?: readonly ChannelId[];
}

export function createN8nWebhookAdapter(config: N8nWebhookAdapterConfig): ChannelProviderAdapter {
  const channels = config.channels ?? ["email", "whatsapp", "linkedin", "form", "chat", "social"];

  return {
    providerId: PROVIDER_ID,
    channels,
    capabilities: CAPABILITIES,

    async send(request: ChannelSendRequest, transport: Transport, signal: AbortSignal): Promise<ChannelSendResult> {
      const requestId = request.idempotencyKey;
      const startedAt = Date.now();

      try {
        const response = await transport.send({
          url: config.webhookUrl,
          method: "POST",
          headers: { "content-type": "application/json", ...(config.headers ?? {}) },
          body: JSON.stringify({
            channel: request.channel,
            provider: PROVIDER_ID,
            to: request.to,
            subject: request.subject,
            body: request.body,
            metadata: request.metadata,
            idempotencyKey: request.idempotencyKey,
          }),
          signal,
        });
        const latencyMs = Date.now() - startedAt;

        if (response.status === 401 || response.status === 403) {
          return {
            status: "FAILED",
            requestId,
            channel: request.channel,
            provider: PROVIDER_ID,
            error: createChannelError({
              code: "RHIA_CHANNEL_AUTH_FAILED",
              message: "El webhook de n8n rechazo las credenciales de la peticion.",
              provider: PROVIDER_ID,
              originalCode: String(response.status),
            }),
            latencyMs,
          };
        }
        if (response.status === 429) {
          return {
            status: "FAILED",
            requestId,
            channel: request.channel,
            provider: PROVIDER_ID,
            error: createChannelError({
              code: "RHIA_CHANNEL_RATE_LIMITED",
              message: "El webhook de n8n aplico rate limiting a la peticion.",
              provider: PROVIDER_ID,
              originalCode: String(response.status),
            }),
            latencyMs,
          };
        }
        if (response.status >= 500) {
          return {
            status: "FAILED",
            requestId,
            channel: request.channel,
            provider: PROVIDER_ID,
            error: createChannelError({
              code: "RHIA_CHANNEL_PROVIDER_UNAVAILABLE",
              message: "El webhook de n8n devolvio un error de servidor.",
              provider: PROVIDER_ID,
              originalCode: String(response.status),
            }),
            latencyMs,
          };
        }
        if (response.status >= 400) {
          return {
            status: "FAILED",
            requestId,
            channel: request.channel,
            provider: PROVIDER_ID,
            error: createChannelError({
              code: "RHIA_CHANNEL_REJECTED",
              message: "El webhook de n8n rechazo la peticion.",
              safeDetails: response.bodyText.slice(0, 200),
              provider: PROVIDER_ID,
              originalCode: String(response.status),
            }),
            latencyMs,
          };
        }

        const ack = parseAckBody(response.bodyText);
        if (typeof ack.providerMessageId !== "string" || ack.providerMessageId.length === 0) {
          return {
            status: "FAILED",
            requestId,
            channel: request.channel,
            provider: PROVIDER_ID,
            error: createChannelError({
              code: "RHIA_CHANNEL_UNEXPECTED_FAILURE",
              message: "El webhook de n8n respondio 2xx sin providerMessageId.",
              safeDetails: response.bodyText.slice(0, 200),
              provider: PROVIDER_ID,
              originalCode: "MISSING_PROVIDER_MESSAGE_ID",
            }),
            latencyMs,
          };
        }

        return {
          status: "SUCCEEDED",
          requestId,
          channel: request.channel,
          provider: PROVIDER_ID,
          providerMessageId: ack.providerMessageId,
          deliveryStatus: normalizeStatus(ack.status),
          deduplicated: false,
          latencyMs,
        };
      } catch (error) {
        const latencyMs = Date.now() - startedAt;
        if (isAbortError(error)) {
          return {
            status: "FAILED",
            requestId,
            channel: request.channel,
            provider: PROVIDER_ID,
            error: createChannelError({
              code: "RHIA_CHANNEL_TIMEOUT",
              message: "La peticion al webhook de n8n excedio el timeout.",
              provider: PROVIDER_ID,
              originalCode: "ABORTED",
            }),
            latencyMs,
          };
        }
        return {
          status: "FAILED",
          requestId,
          channel: request.channel,
          provider: PROVIDER_ID,
          error: normalizeUnexpectedError(PROVIDER_ID, error),
          latencyMs,
        };
      }
    },

    parseWebhookEvent(rawPayload: unknown): ChannelWebhookEvent {
      const body = rawPayload as N8nWebhookEventBody;
      if (typeof body.providerEventId !== "string" || body.providerEventId.length === 0) {
        throw new Error("Webhook de n8n invalido: falta providerEventId.");
      }
      if (typeof body.providerMessageId !== "string" || body.providerMessageId.length === 0) {
        throw new Error("Webhook de n8n invalido: falta providerMessageId.");
      }
      return {
        provider: PROVIDER_ID,
        providerEventId: body.providerEventId,
        providerMessageId: body.providerMessageId,
        deliveryStatus: normalizeStatus(body.status),
        occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : new Date().toISOString(),
        raw: rawPayload as Readonly<Record<string, unknown>>,
      };
    },
  };
}
