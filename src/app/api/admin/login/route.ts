import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthCookieName, getAuthSecret } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ error: 'PIN kasir wajib diisi' }, { status: 400 });
    }

    const settings = await db.getSettings();
    const correctPin = settings.adminPin || process.env.ADMIN_PIN || '1234';

    if (String(pin).trim() !== String(correctPin).trim()) {
      return NextResponse.json({ error: 'PIN Kasir salah! Silakan coba lagi.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, message: 'Login berhasil' });

    // Set cookie 30 hari (persist di komputer kasir)
    response.cookies.set({
      name: getAuthCookieName(),
      value: getAuthSecret(),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 hari
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan server';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
