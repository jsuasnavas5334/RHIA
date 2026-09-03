import type { GatewayRequest, GatewayResult, ProviderId } from "./contracts.js";
import { createGatewayError } from "./errors.js";
import type { Transport } from "./transport.js";
import type { ProviderAdapter } from "./adapters/types.js";

export interface GatewayInvokeOptions {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

/**
 * AI Gateway: unifica la invocacion a cualquier adapter registrado bajo un
 * timeout comun y, opcionalmente, una cadena de fallback mecanica sobre una
 * lista de candidatos ya resueltos por el caller (el Gateway no decide QUE
 * modelo/proveedor usar -- eso es responsabilidad del Router en PH05-T003).
 */
export class AiGateway {
  private readonly adapters: ReadonlyMap<ProviderId, ProviderAdapter>;
  private readonly transport: Transport;

  constructor(adapters: readonly ProviderAdapter[], transport: Transport) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.providerId, adapter]));
    this.transport = transport;
  }

  getCapabilities(providerId: ProviderId) {
    return this.adapters.get(providerId)?.capabilities;
  }

  async invoke(request: GatewayRequest, options: GatewayInvokeOptions): Promise<GatewayResult> {
    const adapter = this.adapters.get(request.provider);
    if (adapter === undefined) {
      return {
        status: "FAILED",
        requestId: request.requestId,
        provider: request.provider,
        model: request.model,
        error: createGatewayError({
          code: "RHIA_AI_PROVIDER_UNAVAILABLE",
          message: `No hay adapter registrado para el proveedor '${request.provider}'.`,
          providerId: request.provider,
          originalCode: "ADAPTER_NOT_REGISTERED",
        }),
        latencyMs: 0,
      };
    }

    if (request.tools.length > 0 && !adapter.capabilities.supportsTools) {
      return {
        status: "FAILED",
        requestId: request.requestId,
        provider: request.provider,
        model: request.model,
        error: createGatewayError({
          code: "RHIA_AI_UNSUPPORTED_CAPABILITY",
          message: `El proveedor '${request.provider}' no soporta tool calling.`,
          providerId: request.provider,
          originalCode: "TOOLS_UNSUPPORTED",
        }),
        latencyMs: 0,
      };
    }
    if (request.responseFormat.kind === "json" && !adapter.capabilities.supportsJsonMode) {
      return {
        status: "FAILED",
        requestId: request.requestId,
        provider: request.provider,
        model: request.model,
        error: createGatewayError({
          code: "RHIA_AI_UNSUPPORTED_CAPABILITY",
          message: `El proveedor '${request.provider}' no soporta modo JSON estructurado.`,
          providerId: request.provider,
          originalCode: "JSON_MODE_UNSUPPORTED",
        }),
        latencyMs: 0,
      };
    }

    const controller = new AbortController();
    const onExternalAbort = (): void => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      return await adapter.invoke(request, this.transport, controller.signal);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  /**
   * Intenta cada candidato en orden hasta el primer SUCCEEDED. Si todos
   * fallan, devuelve un error agregado RHIA_AI_ALL_CANDIDATES_FAILED con el
   * detalle del ultimo intento en safeDetails.
   */
  async invokeWithFallback(
    candidates: readonly GatewayRequest[],
    options: GatewayInvokeOptions,
  ): Promise<GatewayResult> {
    if (candidates.length === 0) {
      throw new Error("invokeWithFallback requiere al menos un candidato.");
    }

    let lastResult: GatewayResult | undefined;
    for (const candidate of candidates) {
      const result = await this.invoke(candidate, options);
      if (result.status === "SUCCEEDED") {
        return result;
      }
      lastResult = result;
    }

    const last = lastResult as Extract<GatewayResult, { status: "FAILED" }>;
    const first = candidates[0] as GatewayRequest;
    return {
      status: "FAILED",
      requestId: first.requestId,
      provider: last.provider,
      model: last.model,
      error: createGatewayError({
        code: "RHIA_AI_ALL_CANDIDATES_FAILED",
        message: `Los ${candidates.length} candidatos fallaron. Ultimo error: ${last.error.code}.`,
        safeDetails: last.error.safeDetails,
        providerId: last.provider,
        originalCode: last.error.code,
      }),
      latencyMs: last.latencyMs,
    };
  }
}
