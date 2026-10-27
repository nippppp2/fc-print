import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseRoleFromToken, getAuthCookieName } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieName = getAuthCookieName();
  const token = request.cookies.get(cookieName)?.value;
  const role = parseRoleFromToken(token);

  // 1. Proteksi Halaman Admin (kecuali /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!role) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Hanya Super Admin yang diizinkan masuk ke halaman pengaturan
    if (pathname.startsWith('/admin/pengaturan') && role !== 'SUPER_ADMIN') {
      const adminUrl = new URL('/admin', request.url);
      return NextResponse.redirect(adminUrl);
    }
  }

  // 2. Proteksi API Admin (kecuali /api/admin/login dan GET /api/admin/settings)
  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
    if (pathname === '/api/admin/settings' && request.method === 'GET') {
      return NextResponse.next();
    }

    if (!role) {
      return NextResponse.json(
        { error: 'Akses ditolak. Silakan login terlebih dahulu.' },
        { status: 401 }
      );
    }

    // Mengubah pengaturan toko via POST hanya untuk Super Admin
    if (pathname === '/api/admin/settings' && request.method === 'POST' && role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Hanya Super Admin yang diizinkan mengubah pengaturan toko.' },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
