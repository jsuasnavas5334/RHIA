import type { BetterAuthOptions } from 'better-auth';
import type { Pool } from 'pg';

export type RhiaAuthRuntime = Readonly<{
  baseUrl: string;
  production: boolean;
  secret: string;
}>;

const fields = {
  user: {
    name: 'name', email: 'email', emailVerified: 'email_verified', image: 'image_url',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
  session: {
    expiresAt: 'expires_at', token: 'token', createdAt: 'created_at', updatedAt: 'updated_at',
    ipAddress: 'ip_address', userAgent: 'user_agent', userId: 'user_id',
  },
  account: {
    issuer: 'issuer', accountId: 'account_id', providerId: 'provider_id', userId: 'user_id',
    accessToken: 'access_token', refreshToken: 'refresh_token', idToken: 'id_token',
    accessTokenExpiresAt: 'access_token_expires_at', refreshTokenExpiresAt: 'refresh_token_expires_at',
    scope: 'scope', password: 'password_hash', createdAt: 'created_at', updatedAt: 'updated_at',
  },
  verification: {
    identifier: 'identifier_hash', value: 'value_hash', expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at',
  },
  rateLimit: { key: 'key_hash', count: 'count', lastRequest: 'last_request_at_ms' },
} as const;

export const createRhiaAuthOptions = (pool: Pool, runtime: RhiaAuthRuntime): BetterAuthOptions => {
  if (runtime.secret.length < 32) throw new TypeError('El secret de auth debe tener al menos 32 caracteres.');
  const baseUrl = new URL(runtime.baseUrl);
  if (runtime.production && baseUrl.protocol !== 'https:') {
    throw new TypeError('Auth de producción requiere HTTPS.');
  }
  return {
    appName: 'RHIA',
    baseURL: baseUrl.origin,
    basePath: '/api/auth',
    secret: runtime.secret,
    database: pool,
    trustedOrigins: [baseUrl.origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      modelName: 'auth_user',
      fields: fields.user,
      additionalFields: {
        appUserId: { type: 'string', fieldName: 'app_user_id', required: true, input: false },
      },
      deleteUser: { enabled: false },
    },
    session: {
      modelName: 'auth_session',
      fields: fields.session,
      expiresIn: 8 * 60 * 60,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    account: { modelName: 'auth_account', fields: fields.account },
    verification: {
      modelName: 'auth_verification',
      fields: fields.verification,
      storeIdentifier: 'hashed',
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'auth_rate_limit',
      fields: fields.rateLimit,
      window: 60,
      max: 30,
      customRules: { '/sign-in/email': { window: 15 * 60, max: 5 } },
    },
    advanced: {
      cookiePrefix: 'rhia',
      trustedProxyHeaders: false,
      ipAddress: { ipAddressHeaders: ['x-rhia-peer-ip'], ipv6Subnet: 64 },
      useSecureCookies: runtime.production,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'strict',
        secure: runtime.production,
        path: '/',
      },
      database: { generateId: 'uuid', joins: false },
    },
  };
};

export const rhiaAuthFieldMapping = fields;
