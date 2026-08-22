import type { Pool } from 'pg';

const SIGN_IN_PATH = '/api/auth/sign-in/email';

export const recordAuthHttpOutcome = async (pool: Pool, path: string, statusCode: number): Promise<void> => {
  if (path !== SIGN_IN_PATH || statusCode < 400) return;
  const status = statusCode === 429 ? 'LOGIN_RATE_LIMITED' : 'LOGIN_FAILED';
  await pool.query(`
    INSERT INTO rhia.system_health_event (component, status, detail)
    VALUES ('AUTH', $1, jsonb_build_object('route', $2::text, 'httpStatus', $3::integer))`,
  [status, SIGN_IN_PATH, statusCode]);
};

export const settleAuthAudit = async (audit: Promise<void>, timeoutMs = 500): Promise<void> => {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
    timer.unref();
  });
  try {
    await Promise.race([audit.catch(() => undefined), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
