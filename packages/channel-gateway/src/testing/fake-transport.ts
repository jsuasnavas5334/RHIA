import type { Transport, TransportRequest, TransportResponse } from "../transport.js";

export type FakeTransportBehavior =
  | { readonly kind: "respond"; readonly status: number; readonly body: unknown; readonly delayMs?: number }
  | { readonly kind: "throw"; readonly message: string; readonly delayMs?: number }
  | { readonly kind: "hang" };

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Transporte de pruebas: nunca hace red real. Mismo diseño que
 * @rhia/ai-gateway/testing/fake-transport.ts -- cola de comportamientos
 * programados (uno por llamada a send) para simular respuesta normal,
 * outage (throw) o timeout (hang hasta que el caller aborte la señal).
 */
export class FakeTransport implements Transport {
  private readonly queue: FakeTransportBehavior[];
  readonly requests: TransportRequest[] = [];

  constructor(behaviors: readonly FakeTransportBehavior[]) {
    this.queue = [...behaviors];
  }

  async send(request: TransportRequest): Promise<TransportResponse> {
    this.requests.push(request);
    const behavior = this.queue.shift();
    if (behavior === undefined) {
      throw new Error("FakeTransport: no quedan comportamientos programados.");
    }

    if (behavior.kind === "hang") {
      return await new Promise<TransportResponse>((_resolve, reject) => {
        request.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    }

    if (behavior.delayMs !== undefined) {
      await delay(behavior.delayMs, request.signal);
    }

    if (behavior.kind === "throw") {
      throw new Error(behavior.message);
    }

    return {
      status: behavior.status,
      headers: {},
      bodyText: JSON.stringify(behavior.body),
    };
  }
}
