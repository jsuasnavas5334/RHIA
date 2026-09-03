import type { GatewayCapabilities, GatewayRequest, GatewayResult } from "../contracts.js";
import type { Transport } from "../transport.js";
import type { ProviderAdapter } from "./types.js";
import { invokeOpenAiCompatible, type ProviderConnectionConfig } from "./shared-openai-compatible.js";

const CAPABILITIES: GatewayCapabilities = {
  supportsTools: true,
  supportsJsonMode: true,
  supportsStreaming: true,
  supportsVision: false,
  maxContextTokens: 64_000,
};

const PRICING = { inputPerMillionUsd: 0.27, outputPerMillionUsd: 1.1 };

export function createDeepSeekAdapter(
  config: ProviderConnectionConfig = { baseUrl: "https://api.deepseek.com/v1", apiKey: "" },
): ProviderAdapter {
  return {
    providerId: "deepseek",
    capabilities: CAPABILITIES,
    invoke(request: GatewayRequest, transport: Transport, signal: AbortSignal): Promise<GatewayResult> {
      return invokeOpenAiCompatible("deepseek", config, PRICING, request, transport, signal);
    },
  };
}
