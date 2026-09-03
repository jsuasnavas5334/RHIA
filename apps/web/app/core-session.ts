import 'server-only';
import { cache } from 'react';
import type { HumanRole } from '@rhia/policy';
import { RhiaCoreClient } from '../src/core-client.ts';
import { rhiaSessionCookieHeader } from './auth-cookie.ts';

export const loadRhiaCoreSession = cache(async (): Promise<Readonly<{
  client: RhiaCoreClient;
  cookieHeader: string;
  roles: readonly HumanRole[];
}>> => {
  const origin = process.env['RHIA_CORE_API_URL'];
  if (!origin) throw new Error('RHIA_CORE_API_URL no configurado.');
  const client = new RhiaCoreClient(origin);
  const cookieHeader = await rhiaSessionCookieHeader();
  const { roles } = await client.getSession(cookieHeader);
  return { client, cookieHeader, roles };
});
