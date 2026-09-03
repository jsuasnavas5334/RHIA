import 'server-only';
import { cookies } from 'next/headers';

const sessionCookieNames = ['rhia.session_token', '__Secure-rhia.session_token'] as const;

export const rhiaSessionCookieHeader = async (): Promise<string> => {
  const cookieStore = await cookies();
  return sessionCookieNames.flatMap((name) => {
    const cookie = cookieStore.get(name);
    return cookie ? [`${name}=${cookie.value}`] : [];
  }).join('; ');
};
