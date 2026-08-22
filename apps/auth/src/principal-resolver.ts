import type { IncomingHttpHeaders } from 'node:http';
import { humanRoles, type HumanRole, type Principal } from '@rhia/policy';
import type { Pool } from 'pg';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionView = Readonly<{
  session: Readonly<{ expiresAt: Date | string }>;
  user: Readonly<{ appUserId?: unknown }>;
}>;

export type BetterAuthSessionApi = Readonly<{
  api: Readonly<{ getSession(input: { headers: Headers }): Promise<unknown> }>;
}>;

export class AuthenticationRequiredError extends Error {
  public constructor() {
    super('Se requiere una sesión RHIA válida y autorizada.');
    this.name = 'AuthenticationRequiredError';
  }
}

const toHeaders = (source: IncomingHttpHeaders): Headers => {
  const result = new Headers();
  for (const [name, value] of Object.entries(source)) {
    if (Array.isArray(value)) for (const item of value) result.append(name, item);
    else if (value !== undefined) result.set(name, String(value));
  }
  return result;
};

const isSessionView = (value: unknown): value is SessionView => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { session?: unknown; user?: unknown };
  if (!candidate.session || typeof candidate.session !== 'object' || !candidate.user || typeof candidate.user !== 'object') return false;
  return 'expiresAt' in candidate.session;
};

export class PostgresPrincipalResolver {
  public constructor(private readonly pool: Pool) {}

  public async resolve(appUserId: string): Promise<Principal | undefined> {
    if (!UUID.test(appUserId)) return undefined;
    const result = await this.pool.query<{ id: string; organization_id: string; status: string; roles: string[] }>(`
      SELECT u.id, u.organization_id, u.status,
        coalesce(array_agg(DISTINCT r.key ORDER BY r.key) FILTER (WHERE r.key IS NOT NULL), ARRAY[]::text[]) AS roles
      FROM rhia.app_user u
      JOIN rhia.auth_user au ON au.app_user_id=u.id
      LEFT JOIN rhia.user_role ur ON ur.user_id=u.id
      LEFT JOIN rhia.role r ON r.id=ur.role_id AND r.organization_id=u.organization_id
      WHERE u.id=$1
      GROUP BY u.id, u.organization_id, u.status`, [appUserId]);
    const row = result.rows[0];
    if (!row || row.status !== 'ACTIVE' || row.roles.length === 0) return undefined;
    const allowed = new Set<string>(humanRoles);
    if (row.roles.some((role) => !allowed.has(role))) return undefined;
    return { kind: 'HUMAN', id: row.id, organizationId: row.organization_id, roles: row.roles as HumanRole[] };
  }
}

export const createSessionPrincipalAuthenticator = (
  auth: BetterAuthSessionApi,
  resolver: PostgresPrincipalResolver,
): ((request: { headers: IncomingHttpHeaders }) => Promise<Principal>) => async (request) => {
  const value = await auth.api.getSession({ headers: toHeaders(request.headers) });
  if (!isSessionView(value)) throw new AuthenticationRequiredError();
  const expiresAt = new Date(value.session.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw new AuthenticationRequiredError();
  if (typeof value.user.appUserId !== 'string') throw new AuthenticationRequiredError();
  const principal = await resolver.resolve(value.user.appUserId);
  if (!principal) throw new AuthenticationRequiredError();
  return principal;
};
