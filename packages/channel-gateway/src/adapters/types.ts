import type { ChannelId, ChannelSendRequest, ChannelSendResult, ChannelWebhookEvent } from "../contracts.js";
import type { Transport } from "../transport.js";

export interface ChannelProviderCapabilities {
  readonly supportsSubject: boolean;
  readonly supportsAttachments: boolean;
  readonly maxBodyLength: number;
}

/**
 * Un adapter conecta un `provider` concreto (p.ej. "n8n-webhook") con uno o
 * mas canales. La logica de idempotencia, timeout y normalizacion de
 * errores inesperados vive en ChannelGateway (gateway.ts), no aqui -- el
 * adapter solo traduce el contrato neutral hacia/desde el proveedor.
 */
export interface ChannelProviderAdapter {
  readonly providerId: string;
  readonly channels: readonly ChannelId[];
  readonly capabilities: ChannelProviderCapabilities;
  send(
    request: ChannelSendRequest,
    transport: Transport,
    signal: AbortSignal,
  ): Promise<ChannelSendResult>;
  /**
   * Traduce el payload crudo de un webhook del proveedor al contrato
   * neutral ChannelWebhookEvent. Lanza si el payload no tiene la forma
   * esperada -- el caller (gateway/host) decide como responder ese caso.
   */
  parseWebhookEvent(rawPayload: unknown): ChannelWebhookEvent;
}
