import type { GatewayCapabilities, GatewayRequest, GatewayResult } from "../contracts.js";
import type { Transport } from "../transport.js";
import type { ProviderAdapter } from "./types.js";
import { invokeOpenAiCompatible, type ProviderConnectionConfig } from "./shared-openai-compatible.js";

const CAPABILITIES: GatewayCapabilities = {
  supportsTools: true,
  supportsJsonMode: true,
  supportsStreaming: true,
  supportsVision: true,
  maxContextTokens: 128_000,
};

// Precios de referencia (USD por millon de tokens) solo para estimar costo;
// no reflejan la lista de precios oficial vigente y deben tratarse como
// aproximacion documentada, nunca como fuente de facturacion real.
const PRICING = { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10 };

export function createOpenAiAdapter(
  config: ProviderConnectionConfig = { baseUrl: "https://api.openai.com/v1", apiKey: "" },
): ProviderAdapter {
  return {
    providerId: "openai",
    capabilities: CAPABILITIES,
    invoke(request: GatewayRequest, transport: Transport, signal: AbortSignal): Promise<GatewayResult> {
      return invokeOpenAiCompatible("openai", config, PRICING, request, transport, signal);
    },
  };
}
