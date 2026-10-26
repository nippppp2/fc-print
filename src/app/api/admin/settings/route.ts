import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const settings = await db.getSettings();
  return NextResponse.json({ success: true, settings });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = await db.updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
