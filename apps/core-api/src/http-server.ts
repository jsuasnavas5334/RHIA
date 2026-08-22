import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { UuidSchema } from '@rhia/contracts';
import type { Principal } from '@rhia/policy';
import { CoreApi, normalizedError, type CoreApiResponse } from './api.js';

export type PrincipalAuthenticator = (request: IncomingMessage) => Promise<Principal>;
export type CoreHttpOptions = Readonly<{
  authenticate: PrincipalAuthenticator;
  maxBodyBytes?: number;
}>;

class TransportError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'TransportError';
  }
}

const correlationIdFor = (request: IncomingMessage): string => {
  const raw = request.headers['x-correlation-id'];
  return typeof raw === 'string' && UuidSchema.safeParse(raw).success ? raw : randomUUID();
};

const readJson = async (request: IncomingMessage, maxBodyBytes: number): Promise<unknown> => {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new TransportError(415, 'Core API requiere Content-Type application/json.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new TransportError(413, 'El payload excede el límite permitido.');
    chunks.push(buffer);
  }
  if (size === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new TransportError(400, 'El body no contiene JSON válido.');
  }
};

const send = (response: import('node:http').ServerResponse, correlationId: string, result: CoreApiResponse): void => {
  response.statusCode = result.status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-correlation-id', correlationId);
  response.end(JSON.stringify(result.body));
};

export const createCoreHttpServer = (api: CoreApi, options: CoreHttpOptions): Server => {
  const maxBodyBytes = options.maxBodyBytes ?? 1_048_576;
  return createServer(async (request, response) => {
    const correlationId = correlationIdFor(request);
    try {
      if (request.method !== 'GET' && request.method !== 'POST') {
        send(response, correlationId, normalizedError(
          'RHIA_CONTRACT_INVALID_PAYLOAD', 'Método HTTP no permitido por Core API v1.', correlationId, 405,
        ));
        return;
      }
      let principal: Principal;
      try {
        principal = await options.authenticate(request);
      } catch {
        send(response, correlationId, normalizedError('RHIA_POLICY_DENIED', 'Autenticación requerida.', correlationId, 401));
        return;
      }
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      const body = request.method === 'POST' ? await readJson(request, maxBodyBytes) : undefined;
      const result = await api.handle({ method: request.method, path, principal, correlationId, ...(body === undefined ? {} : { body }) });
      send(response, correlationId, result);
    } catch (error) {
      if (error instanceof TransportError) {
        send(response, correlationId, normalizedError('RHIA_CONTRACT_INVALID_PAYLOAD', error.message, correlationId, error.status));
        return;
      }
      send(response, correlationId, normalizedError('RHIA_CORE_UNEXPECTED_FAILURE', 'Core HTTP no pudo completar la solicitud.', correlationId, 500));
    }
  });
};
