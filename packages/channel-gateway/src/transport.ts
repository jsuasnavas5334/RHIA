// Transporte inyectable: los adapters de canal nunca llaman fetch()
// directamente, siempre reciben un Transport. Mismo principio que
// @rhia/ai-gateway/transport.ts: permite fakes deterministicos en pruebas y
// mantiene las credenciales reales del proveedor fuera de este paquete (las
// inyecta el proceso host/worker).

export interface TransportRequest {
  readonly url: string;
  readonly method: "GET" | "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
  readonly signal: AbortSignal;
}

export interface TransportResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly bodyText: string;
}

export interface Transport {
  send(request: TransportRequest): Promise<TransportResponse>;
}

interface MinimalFetchResponse {
  readonly status: number;
  text(): Promise<string>;
  readonly headers: { forEach(callback: (value: string, key: string) => void): void };
}
declare function fetch(
  url: string,
  init: { method: string; headers: Readonly<Record<string, string>>; body?: string; signal: AbortSignal },
): Promise<MinimalFetchResponse>;

/**
 * Transporte real basado en fetch global. No se usa en pruebas (que usan
 * FakeTransport); el proceso host (worker) lo instancia e inyecta con las
 * URLs/credenciales reales fuera de este paquete.
 */
export class FetchTransport implements Transport {
  async send(request: TransportRequest): Promise<TransportResponse> {
    const init: { method: string; headers: Readonly<Record<string, string>>; body?: string; signal: AbortSignal } =
      request.body !== null
        ? { method: request.method, headers: request.headers, body: request.body, signal: request.signal }
        : { method: request.method, headers: request.headers, signal: request.signal };
    const response = await fetch(request.url, init);
    const bodyText = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { status: response.status, headers, bodyText };
  }
}
