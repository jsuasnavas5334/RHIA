import type { GatewayCapabilities, GatewayRequest, GatewayResult } from "../contracts.js";
import type { Transport } from "../transport.js";
import type { ProviderAdapter } from "./types.js";
import { invokeOpenAiCompatible, type ProviderConnectionConfig } from "./shared-openai-compatible.js";

const CAPABILITIES: GatewayCapabilities = {
  supportsTools: true,
  supportsJsonMode: true,
  supportsStreaming: true,
  supportsVision: false,
  maxContextTokens: 32_000,
};

const PRICING = { inputPerMillionUsd: 0.5, outputPerMillionUsd: 1.5 };

// Qwen (Alibaba DashScope) expone un modo "compatible" con la forma de
// OpenAI Chat Completions; usamos ese modo para no duplicar logica.
export function createQwenAdapter(
  config: ProviderConnectionConfig = {
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    apiKey: "",
  },
): ProviderAdapter {
  return {
    providerId: "qwen",
    capabilities: CAPABILITIES,
    invoke(request: GatewayRequest, transport: Transport, signal: AbortSignal): Promise<GatewayResult> {
      return invokeOpenAiCompatible("qwen", config, PRICING, request, transport, signal);
    },
  };
}
