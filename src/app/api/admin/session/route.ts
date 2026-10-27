import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';

export async function GET() {
  const { authenticated, role } = await verifyAdminAuth();
  if (!authenticated || !role) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, role });
}
