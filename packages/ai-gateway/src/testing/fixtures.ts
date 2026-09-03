import type { GatewayRequest, ProviderId } from "../contracts.js";

export function makeRequest(provider: ProviderId, model: string, overrides: Partial<GatewayRequest> = {}): GatewayRequest {
  return {
    requestId: overrides.requestId ?? "req-test-1",
    provider,
    model,
    messages: overrides.messages ?? [{ role: "user", content: [{ type: "text", text: "hola" }] }],
    tools: overrides.tools ?? [],
    responseFormat: overrides.responseFormat ?? { kind: "text" },
    maxOutputTokens: overrides.maxOutputTokens ?? 256,
    temperature: overrides.temperature ?? 0,
  };
}
