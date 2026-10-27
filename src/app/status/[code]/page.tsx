'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  ArrowLeft,
  XCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';

function OrderStatusContent({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const { code } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [queueAhead, setQueueAhead] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Trigger getar dan bunyi lonceng saat pesanan siap diambil
  const triggerReadyAlert = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([250, 100, 250, 100, 400]);
      }
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {
      // Audio autoplay policy
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/orders/${code}`);
      if (!res.ok) {
        throw new Error('Pesanan tidak ditemukan');
      }
      const data = await res.json();
      const prevStatus = order?.status;
      setOrder(data.order);
      setQueueAhead(data.queueAhead || 0);

      if (data.order.status === 'COMPLETED' || data.order.status === 'CANCELLED') {
        try {
          localStorage.removeItem('active_order');
        } catch {
          // ignore
        }
      }

      if (prevStatus && prevStatus !== 'READY' && data.order.status === 'READY') {
        triggerReadyAlert();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat status';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 4000);
    return () => clearInterval(timer);
  }, [code]);

  const handleCancelOrder = async () => {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${code}`, { method: 'PATCH' });
      if (res.ok) {
        try {
          localStorage.removeItem('active_order');
        } catch {
          // ignore
        }
        fetchStatus();
      } else {
        const d = await res.json();
        alert(d.error || 'Gagal membatalkan pesanan');
      }
    } catch {
      alert('Gagal membatalkan pesanan');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ color: 'var(--text-muted)' }}>Memuat status antrean...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <AlertCircle size={48} color="#dc2626" style={{ margin: '0 auto 1rem' }} />
        <h2>{error || 'Pesanan Tidak Ditemukan'}</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          Pastikan link atau kode QR antrean Anda sudah benar.
        </p>
        <button className="btn btn-primary" onClick={() => router.push('/')}>
          Kirim Dokumen Baru
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-pending">Menunggu Giliran Kasir</span>;
      case 'PRINTING':
        return <span className="badge badge-printing">Sedang Diproses Kasir</span>;
      case 'READY':
        return <span className="badge badge-ready">Siap Diambil di Kasir</span>;
      case 'COMPLETED':
        return <span className="badge badge-completed">Pesanan Selesai</span>;
      case 'CANCELLED':
        return <span className="badge badge-cancelled">Dibatalkan</span>;
    }
  };

  return (
    <>
      <header className="navbar">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => router.push('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <ArrowLeft size={16} /> Kirim Dokumen Lain
        </button>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Status Antrean
        </div>
      </header>

      <main className="container" style={{ maxWidth: '600px' }}>
        {/* Nomor Antrean Utama */}
        <section
          className="card"
          style={{
            textAlign: 'center',
            padding: '2.5rem 1.25rem',
            borderTop: order.status === 'READY' ? '6px solid #10b981' : '6px solid var(--primary)',
          }}
        >
          <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>
            Nomor Antrean Anda
          </div>

          <div className="queue-giant">{order.queueNumber}</div>

          {order.customerName && (
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '0.35rem 0.85rem',
                borderRadius: '9999px',
              }}
            >
              <span>Pesanan a.n:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{order.customerName}</strong>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            {getStatusBadge(order.status)}
          </div>

          {order.status === 'READY' && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                color: '#065f46',
                fontWeight: 600,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <CheckCircle size={20} color="#059669" />
              <span>Dokumen sudah siap! Silakan sebutkan nomor antrean ke kasir.</span>
            </div>
          )}

          {order.status === 'CANCELLED' && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem 1rem',
                color: '#991b1b',
                marginTop: '1.25rem',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
                Pesanan Ini Telah Dibatalkan
              </div>
              <div style={{ fontSize: '0.85rem', color: '#b91c1c', marginBottom: '1rem' }}>
                Pengiriman dokumen telah dibatalkan dan tidak lagi diproses oleh kasir.
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => router.push('/')}
                style={{ width: '100%' }}
              >
                + Kirim Dokumen Baru
              </button>
            </div>
          )}

          {order.status === 'COMPLETED' && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem 1rem',
                color: '#334155',
                marginTop: '1.25rem',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem', color: '#0f172a' }}>
                Pesanan Selesai
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                Dokumen Anda telah selesai dicetak dan diambil di kasir. Terima kasih!
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => router.push('/')}
                style={{ width: '100%' }}
              >
                + Kirim Dokumen Lain
              </button>
            </div>
          )}
        </section>

        {/* Daftar File yang Dikirim */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">
              <FileText size={18} color="var(--primary)" /> Dokumen Terkirim ({order.files.length})
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {order.files.map((file, idx) => (
              <div
                key={file.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.75rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {file.fileType.includes('image') ? (
                  <ImageIcon size={20} color="var(--primary)" />
                ) : (
                  <FileText size={20} color="var(--primary)" />
                )}
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {file.originalFilename}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {(file.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tombol Batalkan Pesanan */}
        {order.status === 'PENDING' && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleCancelOrder}
              disabled={cancelling}
            >
              <XCircle size={16} /> Batalkan Pengiriman Dokumen
            </button>
          </div>
        )}
      </main>
    </>
  );
}

export default function OrderStatusPage(props: {
  params: Promise<{ code: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <div style={{ color: 'var(--text-muted)' }}>Memuat status antrean...</div>
        </div>
      }
    >
      <OrderStatusContent params={props.params} />
    </Suspense>
  );
}
