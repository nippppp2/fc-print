import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Order, OrderFileConfig } from '@/lib/types';
import { nanoid } from 'nanoid';
import { getPresignedDownloadUrl } from '@/lib/r2';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { files } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'Pesanan harus berisi minimal 1 dokumen' },
        { status: 400 }
      );
    }

    const settings = await db.getSettings();
    if (!settings.isOpen) {
      return NextResponse.json(
        { error: 'Mohon maaf, toko sedang tutup untuk sementara waktu' },
        { status: 403 }
      );
    }

    const orderFiles: OrderFileConfig[] = files.map((f: OrderFileConfig) => ({
      id: nanoid(10),
      originalFilename: f.originalFilename,
      storageKey: f.storageKey,
      fileType: f.fileType,
      fileSizeBytes: f.fileSizeBytes || 0,
    }));

    const queueNumber = await db.generateQueueNumber();
    const trackingCode = nanoid(12);

    const newOrder: Order = {
      id: nanoid(16),
      queueNumber,
      trackingCode,
      status: 'PENDING',
      totalFiles: orderFiles.length,
      files: orderFiles,
      createdAt: new Date().toISOString(),
    };

    await db.saveOrder(newOrder);

    return NextResponse.json({
      success: true,
      queueNumber: newOrder.queueNumber,
      trackingCode: newOrder.trackingCode,
      orderId: newOrder.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal membuat pesanan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const orders = await db.getAllOrders();

    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const enrichedFiles = await Promise.all(
          order.files.map(async (file) => {
            const downloadUrl = await getPresignedDownloadUrl(file.storageKey, file.originalFilename);
            return {
              ...file,
              downloadUrl,
            };
          })
        );
        return {
          ...order,
          files: enrichedFiles,
        };
      })
    );

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengambil antrean';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
