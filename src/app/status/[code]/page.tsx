'use client';

import React, { useEffect, useState, useRef, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  ArrowLeft,
  XCircle,
  Image as ImageIcon,
  Printer,
  Users,
  Check,
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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const prevStatusRef = useRef<OrderStatus | null>(null);

  // Trigger getar dan bunyi lonceng saat pesanan siap diambil
  const triggerReadyAlert = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([250, 100, 250, 100, 400]);
      }
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.65);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.65);
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
      const incomingOrder: Order = data.order;
      const prevStatus = prevStatusRef.current;

      setOrder(incomingOrder);
      setQueueAhead(data.queueAhead || 0);

      if (incomingOrder.status === 'COMPLETED' || incomingOrder.status === 'CANCELLED') {
        try {
          localStorage.removeItem('active_order');
        } catch {
          // ignore
        }
      }

      if (prevStatus && prevStatus !== 'READY' && incomingOrder.status === 'READY') {
        triggerReadyAlert();
      }

      prevStatusRef.current = incomingOrder.status;
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
    setCancelling(true);
    setCancelError('');
    try {
      const res = await fetch(`/api/orders/${code}`, { method: 'PATCH' });
      if (res.ok) {
        try {
          localStorage.removeItem('active_order');
        } catch {
          // ignore
        }
        setShowCancelConfirm(false);
        fetchStatus();
      } else {
        const d = await res.json();
        setCancelError(d.error || 'Gagal membatalkan pesanan');
      }
    } catch {
      setCancelError('Gagal menghubungi server untuk membatalkan pesanan');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="customer-viewport">
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
          }}
        >
          Memuat status antrean...
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="customer-viewport">
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <AlertCircle size={40} color="#dc2626" style={{ marginBottom: '0.75rem' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{error || 'Pesanan Tidak Ditemukan'}</h2>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              marginTop: '0.35rem',
              marginBottom: '1.25rem',
              maxWidth: '320px',
            }}
          >
            Pastikan tautan atau kode QR antrean Anda sudah benar.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/')}>
            Kirim Dokumen Baru
          </button>
        </div>
      </div>
    );
  }

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Menunggu Giliran Kasir', color: '#d97706' };
      case 'PRINTING':
        return { label: 'Sedang Dicetak Kasir', color: '#2563eb' };
      case 'READY':
        return { label: 'Siap Diambil di Kasir', color: '#059669' };
      case 'COMPLETED':
        return { label: 'Pesanan Selesai', color: '#475569' };
      case 'CANCELLED':
        return { label: 'Dibatalkan', color: '#dc2626' };
    }
  };

  // Hitung progres stepper untuk status aktif (PENDING -> PRINTING -> READY/COMPLETED)
  const getStepProgressWidth = (status: OrderStatus) => {
    if (status === 'PENDING') return '0%';
    if (status === 'PRINTING') return '50%';
    if (status === 'READY' || status === 'COMPLETED') return '100%';
    return '0%';
  };

  const isStep1Done =
    order.status === 'PRINTING' || order.status === 'READY' || order.status === 'COMPLETED';
  const isStep2Done = order.status === 'READY' || order.status === 'COMPLETED';
  const isStep3Done = order.status === 'COMPLETED';
  const statusInfo = getStatusText(order.status);

  return (
    <div className="customer-viewport">
      {/* Top Bar */}
      <header className="customer-topbar">
        <div className="customer-topbar-inner">
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: '0.25rem 0',
            }}
          >
            <ArrowLeft size={16} /> Kirim Dokumen Lain
          </button>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Status Antrean
          </span>
        </div>
      </header>

      {/* Main Content 100dvh Tanpa Scroll Halaman */}
      <main className="customer-main">
        <section className="customer-panel">
          {/* Bagian Atas: Nomor Antrean & Stepper */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                fontWeight: 700,
              }}
            >
              Nomor Antrean Anda
            </div>

            <div className="queue-giant">{order.queueNumber}</div>

            {/* Metadata Pemesan & Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '0.4rem',
                fontSize: '0.825rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              {order.customerName && (
                <>
                  <span>
                    Pemesan: <strong style={{ color: 'var(--text-primary)' }}>{order.customerName}</strong>
                  </span>
                  <span aria-hidden="true" style={{ color: '#cbd5e1' }}>·</span>
                </>
              )}
              <span style={{ fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
            </div>

            {/* Visual 3-Step Progress Tracker */}
            {order.status !== 'CANCELLED' && (
              <div className="status-stepper" aria-label="Tahapan proses cetak">
                <div className="status-stepper-line">
                  <div
                    className="status-stepper-line-fill"
                    style={{ width: getStepProgressWidth(order.status) }}
                  />
                </div>

                <div
                  className={`status-step ${
                    order.status === 'PENDING' ? 'active' : isStep1Done ? 'completed' : ''
                  }`}
                >
                  <div className="status-step-circle">
                    {isStep1Done ? <Check size={15} /> : <Clock size={15} />}
                  </div>
                  <div className="status-step-label">Menunggu</div>
                </div>

                <div
                  className={`status-step ${
                    order.status === 'PRINTING' ? 'active' : isStep2Done ? 'completed' : ''
                  }`}
                >
                  <div className="status-step-circle">
                    {isStep2Done ? <Check size={15} /> : <Printer size={15} />}
                  </div>
                  <div className="status-step-label">Dicetak</div>
                </div>

                <div
                  className={`status-step ${
                    order.status === 'READY'
                      ? 'ready-active'
                      : isStep3Done
                      ? 'completed'
                      : ''
                  }`}
                >
                  <div className="status-step-circle">
                    <CheckCircle size={15} />
                  </div>
                  <div className="status-step-label">Siap Diambil</div>
                </div>
              </div>
            )}

            {/* Banner Kontekstual Berdasarkan Status */}
            {order.status === 'PENDING' && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                }}
              >
                <Users size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                {queueAhead > 0 ? (
                  <span>
                    Terdapat <strong style={{ color: 'var(--text-primary)' }}>{queueAhead} antrean</strong> lain di depan Anda.
                  </span>
                ) : (
                  <span>
                    Antrean Anda berada di <strong style={{ color: 'var(--primary)' }}>urutan pertama</strong> untuk segera diproses.
                  </span>
                )}
              </div>
            )}

            {order.status === 'PRINTING' && (
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '0.55rem 0.75rem',
                  color: '#1e40af',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                }}
              >
                <Printer size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                <span>Kasir sedang mengunduh dan mencetak dokumen Anda.</span>
              </div>
            )}

            {order.status === 'READY' && (
              <div
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '10px',
                  padding: '0.6rem 0.75rem',
                  color: '#065f46',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                }}
              >
                <CheckCircle size={16} color="#059669" style={{ flexShrink: 0 }} />
                <span>Dokumen siap! Sebutkan nomor antrean Anda ke kasir.</span>
              </div>
            )}

            {order.status === 'CANCELLED' && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '0.6rem 0.75rem',
                  color: '#991b1b',
                  fontSize: '0.8rem',
                  marginTop: '0.4rem',
                }}
              >
                Pengiriman dokumen ini telah dibatalkan dan dikeluarkan dari antrean.
              </div>
            )}

            {order.status === 'COMPLETED' && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.6rem 0.75rem',
                  color: '#334155',
                  fontSize: '0.8rem',
                }}
              >
                Dokumen telah selesai dicetak dan diambil. Terima kasih!
              </div>
            )}
          </div>

          {/* Bagian Tengah: Daftar Dokumen Terkirim (Scroll Internal) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              marginTop: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              background: '#f8fafc',
              padding: '0.6rem 0.75rem',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontSize: '0.775rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                paddingBottom: '0.45rem',
                marginBottom: '0.45rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <FileText size={14} color="var(--primary)" />
                Dokumen Terkirim ({order.files.length})
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                {(
                  order.files.reduce((acc, f) => acc + f.fileSizeBytes, 0) /
                  (1024 * 1024)
                ).toFixed(2)}{' '}
                MB
              </span>
            </div>

            <div className="customer-scroll-list">
              {order.files.map((file, idx) => (
                <div
                  key={file.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.6rem',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    flexShrink: 0,
                  }}
                >
                  {file.fileType.includes('image') ? (
                    <ImageIcon size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                  ) : (
                    <FileText size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                  )}
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.825rem',
                        color: 'var(--text-primary)',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.originalFilename}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {(file.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bagian Bawah: Aksi Kontekstual (Batal / Kirim Baru) */}
          <div style={{ marginTop: '0.75rem', flexShrink: 0 }}>
            {cancelError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '0.45rem 0.65rem',
                  color: '#dc2626',
                  marginBottom: '0.5rem',
                  fontSize: '0.775rem',
                  textAlign: 'center',
                  fontWeight: 500,
                }}
              >
                {cancelError}
              </div>
            )}

            {order.status === 'PENDING' && (
              <>
                {!showCancelConfirm ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      setCancelError('');
                      setShowCancelConfirm(true);
                    }}
                    disabled={cancelling}
                    style={{
                      width: '100%',
                      height: '40px',
                      borderRadius: '10px',
                      fontSize: '0.825rem',
                    }}
                  >
                    <XCircle size={15} /> Batalkan Pengiriman Dokumen
                  </button>
                ) : (
                  <div
                    style={{
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '10px',
                      padding: '0.6rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#9f1239' }}>
                      Batalkan pesanan ini?
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowCancelConfirm(false)}
                        disabled={cancelling}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        Tidak
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={handleCancelOrder}
                        disabled={cancelling}
                        style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        {cancelling ? 'Memproses...' : 'Ya, Batalkan'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => router.push('/')}
                style={{ width: '100%', height: '42px', borderRadius: '10px', fontSize: '0.875rem' }}
              >
                + Kirim Dokumen Baru
              </button>
            )}
          </div>
        </section>

        {/* Footer Sinkronisasi Otomatis */}
        <footer
          style={{
            textAlign: 'center',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
            padding: '0.1rem 0',
          }}
        >
          Status antrean diperbarui secara otomatis setiap 4 detik.
        </footer>
      </main>
    </div>
  );
}

export default function OrderStatusPage(props: {
  params: Promise<{ code: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="customer-viewport">
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Memuat status antrean...
          </div>
        </div>
      }
    >
      <OrderStatusContent params={props.params} />
    </Suspense>
  );
}
