// Channel Gateway v1 (PH08-T001): unifica el envio saliente y la ingesta de
// callbacks/webhooks de cualquier adapter de canal registrado, bajo un
// timeout comun, con idempotencia real sobre `core_idempotency` (via el
// IdempotencyStore inyectado) y errores siempre normalizados al contrato de
// contracts.ts. Mismo diseño estructural que @rhia/ai-gateway/gateway.ts
// (PH05-T002): el Gateway no decide QUE proveedor usar para cada envio --
// eso lo decide el caller (Sequence Engine, PH08-T002) segun la
// configuracion del canal; el Gateway solo garantiza que el envio a traves
// del adapter elegido sea seguro de reintentar y que los eventos entrantes
// se procesen una sola vez.

import type {
  ChannelSendRequest,
  ChannelSendResult,
  ChannelSendSuccess,
  ChannelWebhookResult,
} from "./contracts.js";
import { createChannelError } from "./errors.js";
import type { Transport } from "./transport.js";
import type { ChannelProviderAdapter } from "./adapters/types.js";
import {
  computeSendFingerprint,
  stableFingerprint,
  type IdempotencyStore,
} from "./idempotency.js";

export interface ChannelGatewaySendOptions {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

const SEND_OPERATION = "channel.send";
const WEBHOOK_OPERATION_PREFIX = "channel.webhook";

export class ChannelGateway {
  private readonly adapters: ReadonlyMap<string, ChannelProviderAdapter>;
  private readonly transport: Transport;
  private readonly idempotency: IdempotencyStore;

  constructor(adapters: readonly ChannelProviderAdapter[], transport: Transport, idempotency: IdempotencyStore) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.providerId, adapter]));
    this.transport = transport;
    this.idempotency = idempotency;
  }

  private failSend(request: ChannelSendRequest, error: ReturnType<typeof createChannelError>): ChannelSendResult {
    return {
      status: "FAILED",
      requestId: request.idempotencyKey,
      channel: request.channel,
      provider: request.provider,
      error,
      latencyMs: 0,
    };
  }

  /**
   * Envia un mensaje por el adapter/canal indicado en la peticion.
   *
   * Idempotencia: solo se registra (y por tanto solo se deduplica) un envio
   * SUCCEEDED -- ver idempotency.ts para la justificacion. Un retry con la
   * misma idempotencyKey y el mismo contenido, sobre un envio previo que ya
   * tuvo exito, devuelve el resultado guardado con `deduplicated: true` sin
   * volver a invocar al proveedor. Un retry sobre una idempotencyKey que ya
   * se uso con contenido DISTINTO se rechaza (RHIA_CHANNEL_IDEMPOTENCY_CONFLICT)
   * en vez de devolver un resultado que no corresponde a lo que se pide
   * ahora.
   */
  async send(request: ChannelSendRequest, options: ChannelGatewaySendOptions): Promise<ChannelSendResult> {
    const adapter = this.adapters.get(request.provider);
    if (adapter === undefined) {
      return this.failSend(
        request,
        createChannelError({
          code: "RHIA_CHANNEL_PROVIDER_UNAVAILABLE",
          message: `No hay adapter registrado para el proveedor '${request.provider}'.`,
          provider: request.provider,
          originalCode: "ADAPTER_NOT_REGISTERED",
        }),
      );
    }
    if (!adapter.channels.includes(request.channel)) {
      return this.failSend(
        request,
        createChannelError({
          code: "RHIA_CHANNEL_UNSUPPORTED",
          message: `El proveedor '${request.provider}' no soporta el canal '${request.channel}'.`,
          provider: request.provider,
          originalCode: "CHANNEL_UNSUPPORTED",
        }),
      );
    }

    const fingerprint = computeSendFingerprint(request);
    const idempotencyKey = {
      organizationId: request.organizationId,
      operation: SEND_OPERATION,
      idempotencyKey: request.idempotencyKey,
    };

    const existing = await this.idempotency.get<ChannelSendSuccess>(idempotencyKey);
    if (existing.found) {
      if (existing.fingerprint !== fingerprint) {
        return this.failSend(
          request,
          createChannelError({
            code: "RHIA_CHANNEL_IDEMPOTENCY_CONFLICT",
            message: "La idempotencyKey ya se uso antes con un contenido distinto.",
            provider: request.provider,
            originalCode: "FINGERPRINT_MISMATCH",
          }),
        );
      }
      return { ...existing.resourceSnapshot, deduplicated: true };
    }

    const controller = new AbortController();
    const onExternalAbort = (): void => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    let result: ChannelSendResult;
    try {
      result = await adapter.send(request, this.transport, controller.signal);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }

    if (result.status === "SUCCEEDED") {
      await this.idempotency.record({
        key: idempotencyKey,
        fingerprint,
        resourceType: "channel_send",
        resourceId: result.providerMessageId,
        resourceSnapshot: result,
      });
    }

    return result;
  }

  /**
   * Procesa un webhook entrante de un proveedor (delivery status, bounce,
   * read receipt). Deduplicado por providerEventId dentro del namespace de
   * operacion del proveedor: un mismo evento reentregado por el proveedor
   * (comportamiento normal de casi todos los proveedores de webhooks, que
   * reintentan hasta recibir 2xx) se procesa una sola vez.
   */
  async handleWebhookEvent(input: {
    readonly organizationId: string;
    readonly provider: string;
    readonly rawPayload: unknown;
  }): Promise<ChannelWebhookResult> {
    const adapter = this.adapters.get(input.provider);
    if (adapter === undefined) {
      throw new Error(`No hay adapter registrado para el proveedor '${input.provider}'.`);
    }

    const event = adapter.parseWebhookEvent(input.rawPayload);
    const fingerprint = stableFingerprint(event);
    const idempotencyKey = {
      organizationId: input.organizationId,
      operation: `${WEBHOOK_OPERATION_PREFIX}.${input.provider}`,
      idempotencyKey: event.providerEventId,
    };

    const existing = await this.idempotency.get(idempotencyKey);
    if (existing.found) {
      return { outcome: "DUPLICATE_IGNORED", event };
    }

    await this.idempotency.record({
      key: idempotencyKey,
      fingerprint,
      resourceType: "channel_webhook_event",
      resourceId: event.providerEventId,
      resourceSnapshot: event,
    });

    return { outcome: "PROCESSED", event };
  }
}
