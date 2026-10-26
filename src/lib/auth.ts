import { cookies } from 'next/headers';

const COOKIE_NAME = 'fc_admin_auth';
const AUTH_SECRET = process.env.ADMIN_SESSION_SECRET || 'fc_print_secret_token_2026';

export async function verifyAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return token === AUTH_SECRET;
}

export function getAuthCookieName(): string {
  return COOKIE_NAME;
}

export function getAuthSecret(): string {
  return AUTH_SECRET;
}
