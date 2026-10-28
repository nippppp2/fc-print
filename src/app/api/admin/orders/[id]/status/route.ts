import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { OrderStatus } from '@/lib/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status } = body;

    const validStatuses: OrderStatus[] = [
      'PENDING',
      'PRINTING',
      'READY',
      'COMPLETED',
      'CANCELLED',
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
    }

    const currentOrder = await db.getOrderById(id);
    if (!currentOrder) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    // Aturan Alur Status: Wajib berurutan tahap demi tahap dan dilarang keras mundur
    const validNextSteps: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['PRINTING', 'CANCELLED'],
      PRINTING: ['READY', 'CANCELLED'],
      READY: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowed = validNextSteps[currentOrder.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Status tidak dapat diubah dari ${currentOrder.status} ke ${status}. Alur pesanan harus berurutan (Menunggu → Sedang Cetak → Siap Diambil → Selesai) dan tidak dapat dimundurkan.`,
        },
        { status: 400 }
      );
    }

    const updated = await db.updateOrderStatus(id, status);
    if (!updated) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
