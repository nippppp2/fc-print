import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deleteR2Files } from '@/lib/r2';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const allOrders = await db.getAllOrders();
    const keysToDelete: string[] = [];

    for (const order of allOrders) {
      if (order.filesDeletedAt) continue;

      let shouldDelete = false;

      // 1. Dihapus 24 jam setelah Selesai atau Dibatalkan
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        const completedTime = order.completedAt
          ? new Date(order.completedAt).getTime()
          : new Date(order.createdAt).getTime();
        if (now - completedTime > TWENTY_FOUR_HOURS_MS) {
          shouldDelete = true;
        }
      }

      // 2. Batas maksimal 7 hari jika tidak pernah diselesaikan
      const createdTime = new Date(order.createdAt).getTime();
      if (now - createdTime > SEVEN_DAYS_MS) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        for (const file of order.files) {
          if (file.storageKey) {
            keysToDelete.push(file.storageKey);
          }
        }
        order.filesDeletedAt = new Date().toISOString();
      }
    }

    if (keysToDelete.length > 0) {
      await deleteR2Files(keysToDelete);
    }

    return NextResponse.json({
      success: true,
      cleanedOrdersCount: keysToDelete.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menjalankan pembersihan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
