import { NextResponse } from 'next/server';
import { getAuthCookieName } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Berhasil keluar' });
  response.cookies.set({
    name: getAuthCookieName(),
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return response;
}
