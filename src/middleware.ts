import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'fc_admin_auth';
const AUTH_SECRET = process.env.ADMIN_SESSION_SECRET || 'fc_print_secret_token_2026';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Proteksi Halaman Admin (kecuali /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token || token !== AUTH_SECRET) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Proteksi API Admin (kecuali /api/admin/login dan GET /api/admin/settings untuk info toko buka/tutup)
  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
    if (pathname === '/api/admin/settings' && request.method === 'GET') {
      return NextResponse.next();
    }
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token || token !== AUTH_SECRET) {
      return NextResponse.json(
        { error: 'Akses ditolak. Silakan login kasir terlebih dahulu.' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
