import { betterAuth } from 'better-auth';
import { toNodeHandler } from 'better-auth/node';
import type { RequestListener } from 'node:http';
import type { Pool } from 'pg';
import { createRhiaAuthOptions, type RhiaAuthRuntime } from './auth-options.js';
import { PostgresPrincipalResolver, createSessionPrincipalAuthenticator } from './principal-resolver.js';
import { recordAuthHttpOutcome, settleAuthAudit } from './security-audit.js';

export const createRhiaAuthRuntime = (pool: Pool, runtime: RhiaAuthRuntime) => {
  const auth = betterAuth(createRhiaAuthOptions(pool, runtime));
  const principalResolver = new PostgresPrincipalResolver(pool);
  const authenticate = createSessionPrincipalAuthenticator(auth, principalResolver);
  const betterAuthHandler = toNodeHandler(auth);
  const handler: RequestListener = async (request, response) => {
    const path = new URL(request.url ?? '/', runtime.baseUrl).pathname;
    const peerIp = request.socket.remoteAddress;
    if (peerIp) request.headers['x-rhia-peer-ip'] = peerIp;
    else delete request.headers['x-rhia-peer-ip'];
    response.setHeader('cache-control', 'no-store');
    if (path === '/api/auth/sign-in/email') {
      const originalEnd = response.end.bind(response);
      let ended = false;
      response.end = ((...args: unknown[]) => {
        if (ended) return response;
        ended = true;
        void settleAuthAudit(recordAuthHttpOutcome(pool, path, response.statusCode))
          .finally(() => { Reflect.apply(originalEnd, response, args); });
        return response;
      }) as typeof response.end;
    }
    await betterAuthHandler(request, response);
  };
  return { auth, authenticate, handler, principalResolver } as const;
};
