import { cookies } from 'next/headers';
import { AdminRole } from './types';

const COOKIE_NAME = 'fc_admin_auth';
const AUTH_SECRET = process.env.ADMIN_SESSION_SECRET || 'fc_print_secret_token_2026';

export function createRoleToken(role: AdminRole): string {
  return `${AUTH_SECRET}:${role}`;
}

export function parseRoleFromToken(token?: string | null): AdminRole | null {
  if (!token) return null;
  if (token === `${AUTH_SECRET}:SUPER_ADMIN` || token === AUTH_SECRET) {
    return 'SUPER_ADMIN';
  }
  if (token === `${AUTH_SECRET}:KASIR`) {
    return 'KASIR';
  }
  return null;
}

export async function verifyAdminAuth(): Promise<{ authenticated: boolean; role?: AdminRole }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const role = parseRoleFromToken(token);
  if (!role) {
    return { authenticated: false };
  }
  return { authenticated: true, role };
}

export function getAuthCookieName(): string {
  return COOKIE_NAME;
}

export function getAuthSecret(): string {
  return AUTH_SECRET;
}
