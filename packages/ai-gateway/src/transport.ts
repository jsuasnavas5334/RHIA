// Transporte inyectable: los adapters nunca llaman fetch() directamente,
// siempre reciben un Transport. Esto permite fakes/sandboxes en pruebas y
// evita secretos reales en el gateway (las credenciales viven en la
// implementacion real del transporte, fuera de este paquete).

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

// Declaracion minima y local del fetch global: evitamos depender de los
// tipos DOM/undici completos (no siempre disponibles en todos los entornos
// de build) y solo describimos la porcion que realmente usamos.
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
 * FakeTransport); queda disponible para que el proceso host (worker/runtime)
 * lo inyecte con las credenciales reales fuera de este paquete.
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
