import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthCookieName, createRoleToken } from '@/lib/auth';
import { AdminRole } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ error: 'PIN wajib diisi' }, { status: 400 });
    }

    const settings = await db.getSettings();
    const cleanPin = String(pin).trim();

    // PIN Super Admin (default 9999)
    const superAdminPin = String(settings.superAdminPin || '9999').trim();
    // PIN Kasir (default 1234)
    const kasirPin = String(settings.kasirPin || settings.adminPin || '1234').trim();

    let role: AdminRole | null = null;
    let welcomeMsg = '';

    if (cleanPin === superAdminPin) {
      role = 'SUPER_ADMIN';
      welcomeMsg = 'Login berhasil sebagai Super Admin';
    } else if (cleanPin === kasirPin) {
      role = 'KASIR';
      welcomeMsg = 'Login berhasil sebagai Kasir';
    }

    if (!role) {
      return NextResponse.json({ error: 'PIN salah! Silakan coba lagi.' }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      message: welcomeMsg,
      role,
    });

    // Set cookie 30 hari dengan token peran (Super Admin vs Kasir)
    response.cookies.set({
      name: getAuthCookieName(),
      value: createRoleToken(role),
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
