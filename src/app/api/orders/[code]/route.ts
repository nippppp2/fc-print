import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const order = await db.getOrderByTrackingCode(code);

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const allOrders = await db.getAllOrders();
    const activeOrders = allOrders.filter(
      (o) => o.status === 'PENDING' || o.status === 'PRINTING'
    );
    const orderIndex = activeOrders.findIndex((o) => o.id === order.id);
    const queueAhead = orderIndex > 0 ? orderIndex : 0;

    return NextResponse.json({
      success: true,
      order,
      queueAhead,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memuat status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const order = await db.getOrderByTrackingCode(code);

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Pesanan sudah diproses dan tidak dapat dibatalkan' },
        { status: 400 }
      );
    }

    const updated = await db.updateOrderStatus(order.id, 'CANCELLED');

    return NextResponse.json({
      success: true,
      order: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal membatalkan pesanan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
