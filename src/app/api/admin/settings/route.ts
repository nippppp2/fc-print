import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/auth';
import { isGDriveConfigured } from '@/lib/gdrive';
import { isR2Configured } from '@/lib/r2';

export async function GET() {
  const settings = await db.getSettings();
  const { authenticated, role } = await verifyAdminAuth();
  const storageProvider = isGDriveConfigured ? 'gdrive' : isR2Configured ? 'r2' : 'database';

  // Jika bukan Super Admin (misal pelanggan atau kasir), sembunyikan semua PIN keamanan
  if (!authenticated || role !== 'SUPER_ADMIN') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { kasirPin, superAdminPin, adminPin, ...safeSettings } = settings;
    return NextResponse.json({
      success: true,
      settings: { ...safeSettings, storageProvider },
    });
  }

  return NextResponse.json({
    success: true,
    settings: { ...settings, storageProvider },
  });
}


export async function POST(request: Request) {
  try {
    const { authenticated, role } = await verifyAdminAuth();
    if (!authenticated || role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Hanya Super Admin yang berhak mengubah pengaturan toko.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updated = await db.updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
