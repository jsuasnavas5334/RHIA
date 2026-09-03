import type { GatewayCapabilities, GatewayRequest, GatewayResult, ProviderId } from "../contracts.js";
import type { Transport } from "../transport.js";

export interface ProviderAdapter {
  readonly providerId: ProviderId;
  readonly capabilities: GatewayCapabilities;
  invoke(request: GatewayRequest, transport: Transport, signal: AbortSignal): Promise<GatewayResult>;
}
