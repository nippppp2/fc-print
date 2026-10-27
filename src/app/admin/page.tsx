'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Printer,
  Download,
  Volume2,
  VolumeX,
  RefreshCw,
  Search,
  Settings,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  LogOut,
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';

export default function AdminDashboardPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'KASIR' | null>(null);

  const prevOrderCountRef = useRef<number>(0);

  // Lonceng nada saat ada dokumen masuk
  const playNewOrderChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';

      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      osc.frequency.setValueAtTime(987.77, audioCtx.currentTime + 0.15); // B5

      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {
      // Audio autoplay policy
    }
  };

  const fetchOrders = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        const incomingOrders: Order[] = data.orders || [];

        const pendingCount = incomingOrders.filter((o) => o.status === 'PENDING').length;
        if (prevOrderCountRef.current > 0 && pendingCount > prevOrderCountRef.current) {
          playNewOrderChime();
        }
        prevOrderCountRef.current = pendingCount;

        setOrders(incomingOrders);
      }
    } catch (err) {
      console.error('Gagal mengambil antrean:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Cek peran login saat ini
    fetch('/api/admin/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) setUserRole(data.role);
      })
      .catch(() => {});

    fetchOrders();
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchOrders(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal mengubah status');
      }
    } catch {
      alert('Gagal mengubah status pesanan');
    }
  };

  // Fungsi unduh 1 berkas
  const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Unduh semua berkas dalam 1 pesanan sekaligus
  const downloadAllFiles = (files: Order['files']) => {
    files.forEach((file, idx) => {
      if (file.downloadUrl) {
        setTimeout(() => {
          triggerDownload(file.downloadUrl!, file.originalFilename);
        }, idx * 350);
      }
    });
  };

  // 1-Klik: Unduh file & otomatis ubah status ke 'Sedang Dicetak'
  const handleStartPrint = async (order: Order) => {
    downloadAllFiles(order.files);
    await updateOrderStatus(order.id, 'PRINTING');
  };

  // Filter & Search
  const filteredOrders = orders.filter((order) => {
    if (filterStatus === 'ACTIVE') {
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return false;
    } else if (filterStatus !== 'ALL' && order.status !== filterStatus) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQueue = order.queueNumber.toLowerCase().includes(q);
      const matchFile = order.files.some((f) => f.originalFilename.toLowerCase().includes(q));
      if (!matchQueue && !matchFile) return false;
    }

    return true;
  });

  return (
    <>
      {/* Header Kasir */}
      <header className="navbar" style={{ padding: '0.875rem 2rem' }}>
        <div className="navbar-brand">
          <div className="brand-icon">
            <Printer size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Dashboard Kasir Fotokopi</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Antrean Masuk Dokumen Mandiri
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {userRole === 'SUPER_ADMIN' ? (
            <span
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                fontSize: '0.75rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              👑 Super Admin
            </span>
          ) : userRole === 'KASIR' ? (
            <span
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              💼 Kasir
            </span>
          ) : null}

          <button
            className={`btn btn-sm ${soundEnabled ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Suara notifikasi aktif' : 'Suara notifikasi dimatikan'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{soundEnabled ? 'Suara: Aktif' : 'Suara: Bisu'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchOrders()}
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>

          {userRole === 'SUPER_ADMIN' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => router.push('/admin/pengaturan')}
            >
              <Settings size={16} />
              <span>Poster QR & Pengaturan</span>
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            style={{ color: '#dc2626' }}
            onClick={async () => {
              await fetch('/api/admin/logout', { method: 'POST' });
              router.push('/admin/login');
              router.refresh();
            }}
            title="Keluar dari sesi kasir"
          >
            <LogOut size={16} />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      <main className="container-wide">
        {/* Filter & Search Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.5rem',
            background: 'white',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Tabs Filter */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'ACTIVE', label: 'Antrean Aktif' },
              { id: 'PENDING', label: 'Menunggu' },
              { id: 'PRINTING', label: 'Sedang Cetak' },
              { id: 'READY', label: 'Siap Diambil' },
              { id: 'COMPLETED', label: 'Selesai' },
              { id: 'ALL', label: 'Semua Riwayat' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`btn btn-sm ${filterStatus === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Cari nomor antrean atau file..."
              className="text-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
        </div>

        {/* Daftar Kartu Antrean Dokumen */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Memuat daftar pesanan...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 1rem',
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border)',
            }}
          >
            <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Tidak ada dokumen masuk</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Dokumen yang dikirim pelanggan via QR akan langsung muncul di sini.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {filteredOrders.map((order) => {
              const minutesAgo = Math.floor(
                (Date.now() - new Date(order.createdAt).getTime()) / 60000
              );

              return (
                <div
                  key={order.id}
                  className="card"
                  style={{
                    margin: 0,
                    borderLeft:
                      order.status === 'READY'
                        ? '6px solid #10b981'
                        : order.status === 'PRINTING'
                        ? '6px solid var(--primary)'
                        : '6px solid #d97706',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* Header Kartu */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--primary)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                          {order.queueNumber}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Total: {order.files.length} Dokumen
                        </div>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {minutesAgo === 0 ? 'Baru saja' : `${minutesAgo} mnt lalu`}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div style={{ marginBottom: '1rem' }}>
                      {order.status === 'PENDING' && <span className="badge badge-pending">Menunggu Cetak</span>}
                      {order.status === 'PRINTING' && <span className="badge badge-printing">Sedang Diproses</span>}
                      {order.status === 'READY' && <span className="badge badge-ready">Siap Diambil</span>}
                      {order.status === 'COMPLETED' && <span className="badge badge-completed">Selesai</span>}
                      {order.status === 'CANCELLED' && <span className="badge badge-cancelled">Dibatalkan</span>}
                    </div>

                    {/* Daftar File dengan Tombol Unduh */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                      {order.files.map((file, fIdx) => (
                        <div
                          key={file.id || fIdx}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.625rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                            {file.fileType.includes('image') ? (
                              <ImageIcon size={18} color="var(--primary)" />
                            ) : (
                              <FileText size={18} color="var(--primary)" />
                            )}
                            <div style={{ overflow: 'hidden' }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '200px',
                                }}
                              >
                                {file.originalFilename}
                              </div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                {(file.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                              </div>
                            </div>
                          </div>

                          {file.downloadUrl && (
                            <button
                              type="button"
                              onClick={() => triggerDownload(file.downloadUrl!, file.originalFilename)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                padding: '0.45rem 0.85rem',
                                fontSize: '0.825rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                              }}
                              title={`Unduh ${file.originalFilename}`}
                            >
                              <Download size={14} color="var(--primary)" />
                              <span>Unduh</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tombol Aksi Status & Otomasi Cetak */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem', display: 'flex', gap: '0.5rem' }}>
                    {order.status === 'PENDING' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          padding: '0.75rem 1rem',
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                        onClick={() => handleStartPrint(order)}
                        title="Unduh otomatis semua dokumen dan ubah status ke Sedang Dicetak"
                      >
                        <Printer size={18} />
                        <span>Mulai Cetak (Unduh Dokumen)</span>
                      </button>
                    )}

                    {order.status === 'PRINTING' && (
                      <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.65rem 0.85rem', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => downloadAllFiles(order.files)}
                          title="Unduh ulang dokumen pelanggan"
                        >
                          <Download size={15} /> Unduh Ulang
                        </button>
                        <button
                          type="button"
                          className="btn btn-success"
                          style={{ flex: 1, padding: '0.65rem 1rem', fontSize: '0.925rem', fontWeight: 700 }}
                          onClick={() => updateOrderStatus(order.id, 'READY')}
                        >
                          <CheckCircle2 size={16} /> Tandai Siap Diambil
                        </button>
                      </div>
                    )}

                    {order.status === 'READY' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                      >
                        <CheckCircle2 size={16} /> Selesai
                      </button>
                    )}

                    {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (confirm('Batalkan pesanan ini?')) {
                            updateOrderStatus(order.id, 'CANCELLED');
                          }
                        }}
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
