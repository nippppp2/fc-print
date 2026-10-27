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
  GripVertical,
  Kanban,
  LayoutGrid,
  ArrowRight,
  Sparkles,
  Inbox,
  PackageCheck,
  CheckCheck,
  Store,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Order, OrderStatus, StoreSettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

export default function AdminDashboardPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [filterStatus, setFilterStatus] = useState<string>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'KASIR' | null>(null);

  // Mode Tampilan: 'KANBAN' (Drag & Drop) atau 'GRID' (Kartu Tradisional Cepat)
  const [viewMode, setViewMode] = useState<'KANBAN' | 'GRID'>('KANBAN');

  // Drag & Drop State
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<OrderStatus | null>(null);

  const prevOrderCountRef = useRef<number>(0);

  // Web Audio Synthesizer Effects
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

  const playPickupSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch {
      // Audio autoplay policy
    }
  };

  const playDropSound = (targetStatus: OrderStatus) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (targetStatus === 'READY' || targetStatus === 'COMPLETED') {
        // Melodi sukses / siap
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else {
        // Soft snap pop
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      }
    } catch {
      // Audio policy
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
    // 1. Cek peran login saat ini
    fetch('/api/admin/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) setUserRole(data.role);
      })
      .catch(() => {});

    // 2. Ambil informasi toko
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) setSettings(data.settings);
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
      // Optimistic UI Update agar transisi instan tanpa jeda
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );

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
        fetchOrders(true);
      }
    } catch {
      alert('Gagal mengubah status pesanan');
      fetchOrders(true);
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
        }, idx * 300);
      }
    });
  };

  // 1-Klik / Drag Otomasi: Unduh file & ubah status ke 'Sedang Dicetak'
  const handleStartPrint = async (order: Order) => {
    downloadAllFiles(order.files);
    await updateOrderStatus(order.id, 'PRINTING');
  };

  // ==========================================
  // DRAG & DROP HANDLERS (Interaktif & Fluid)
  // ==========================================
  const handleDragStart = (e: React.DragEvent, order: Order) => {
    e.dataTransfer.setData('text/plain', order.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedOrderId(order.id);
    playPickupSound();
  };

  const handleDragOver = (e: React.DragEvent, targetStatus: OrderStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== targetStatus) {
      setDragOverColumn(targetStatus);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetStatus: OrderStatus) => {
    if (dragOverColumn === targetStatus) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: OrderStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const orderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
    if (!orderId) return;

    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder || targetOrder.status === targetStatus) {
      setDraggedOrderId(null);
      return;
    }

    // Mainkan efek suara
    playDropSound(targetStatus);

    // Fitur Rekomendasi: Jika ditarik ke 'Sedang Diproses' (PRINTING), otomatis langsung unduh dokumen
    if (targetStatus === 'PRINTING') {
      downloadAllFiles(targetOrder.files);
    }

    await updateOrderStatus(orderId, targetStatus);
    setDraggedOrderId(null);
  };

  const handleDragEnd = () => {
    setDraggedOrderId(null);
    setDragOverColumn(null);
  };

  // Perhitungan Statistik Bento
  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const printingOrders = orders.filter((o) => o.status === 'PRINTING');
  const readyOrders = orders.filter((o) => o.status === 'READY');
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const activeOrdersCount = pendingOrders.length + printingOrders.length;

  // Filter & Search untuk Grid View
  const filteredOrders = orders.filter((order) => {
    if (filterStatus === 'ACTIVE') {
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return false;
    } else if (filterStatus !== 'ALL' && order.status !== filterStatus) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQueue = order.queueNumber.toLowerCase().includes(q);
      const matchName = order.customerName ? order.customerName.toLowerCase().includes(q) : false;
      const matchFile = order.files.some((f) => f.originalFilename.toLowerCase().includes(q));
      if (!matchQueue && !matchName && !matchFile) return false;
    }

    return true;
  });

  // Komponen Kartu Pesanan Reusable (Mendukung Drag & Drop)
  const renderOrderCard = (order: Order, isKanban = false) => {
    const minutesAgo = Math.floor(
      (Date.now() - new Date(order.createdAt).getTime()) / 60000
    );
    const isThisDragged = draggedOrderId === order.id;

    return (
      <div
        key={order.id}
        draggable
        onDragStart={(e) => handleDragStart(e, order)}
        onDragEnd={handleDragEnd}
        className={`kanban-card ${isThisDragged ? 'is-dragging' : ''}`}
        style={{
          borderLeft:
            order.status === 'READY'
              ? '5px solid #84cc16'
              : order.status === 'PRINTING'
              ? '5px solid #0284c7'
              : order.status === 'COMPLETED'
              ? '5px solid #94a3b8'
              : '5px solid #f59e0b',
        }}
      >
        {/* Header Kartu */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
              {order.queueNumber}
            </span>
            {order.customerName && (
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                👤 {order.customerName}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={11} /> {minutesAgo === 0 ? 'Baru' : `${minutesAgo}m`}
            </span>
            <GripVertical size={16} style={{ color: '#cbd5e1', cursor: 'grab' }} />
          </div>
        </div>

        {/* Ringkasan File & Detail Unduhan */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.45rem', fontWeight: 600 }}>
            {order.files.length} Dokumen Lampiran:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {order.files.map((file, idx) => (
              <div
                key={file.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.6rem',
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                  {file.fileType.includes('image') ? (
                    <ImageIcon size={14} color="#0284c7" />
                  ) : (
                    <FileText size={14} color="#0284c7" />
                  )}
                  <span
                    style={{
                      fontWeight: 600,
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      maxWidth: isKanban ? '140px' : '220px',
                    }}
                  >
                    {file.originalFilename}
                  </span>
                </div>

                {file.downloadUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerDownload(file.downloadUrl!, file.originalFilename);
                    }}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                    title="Unduh file ini"
                  >
                    <Download size={11} color="#0284c7" /> Unduh
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 1-Klik Status Action Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingTop: '0.5rem', borderTop: '1px dashed #f1f5f9' }}>
          {order.status === 'PENDING' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleStartPrint(order)}
              style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem 0.6rem', gap: '4px', background: '#0284c7', borderColor: '#0284c7' }}
            >
              <Printer size={13} /> Mulai Cetak (Auto-Unduh)
            </button>
          )}

          {order.status === 'PRINTING' && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                playDropSound('READY');
                updateOrderStatus(order.id, 'READY');
              }}
              style={{
                width: '100%',
                fontSize: '0.75rem',
                padding: '0.35rem 0.6rem',
                gap: '4px',
                background: '#84cc16',
                color: '#0f172a',
                border: 'none',
                fontWeight: 800,
              }}
            >
              <CheckCircle2 size={13} /> Tandai Siap Diambil
            </button>
          )}

          {order.status === 'READY' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                playDropSound('COMPLETED');
                updateOrderStatus(order.id, 'COMPLETED');
              }}
              style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem 0.6rem', gap: '4px', background: '#0f172a', color: '#ffffff' }}
            >
              <CheckCheck size={13} color="#a3e635" /> Selesaikan & Berikan
            </button>
          )}

          {order.status === 'COMPLETED' && (
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PackageCheck size={13} color="#10b981" /> Pesanan telah selesai diambil
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="navbar" style={{ padding: '0.75rem 1.75rem', background: 'rgba(255, 255, 255, 0.95)' }}>
        <div className="navbar-brand" style={{ gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0c1a14',
              boxShadow: '0 4px 12px rgba(132, 204, 22, 0.3)',
            }}
          >
            <Printer size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
              {settings.storeName || 'FOTO COPY SEJAHTERA'}
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Dashboard Kasir Pintar</span>
              {userRole === 'SUPER_ADMIN' ? (
                <span style={{ color: '#1d4ed8', fontWeight: 800 }}>• 👑 Super Admin</span>
              ) : (
                <span style={{ color: '#059669', fontWeight: 700 }}>• 💼 Kasir</span>
              )}
            </div>
          </div>
        </div>

        {/* View Switcher & Action Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {/* Pill Switcher: Mode Kanban vs Mode Grid */}
          <div className="pill-tab-container">
            <button
              type="button"
              className={`pill-tab-btn ${viewMode === 'KANBAN' ? 'active pill-tab-btn-lime' : ''}`}
              onClick={() => setViewMode('KANBAN')}
            >
              <Kanban size={15} />
              <span>Papan Kanban</span>
            </button>
            <button
              type="button"
              className={`pill-tab-btn ${viewMode === 'GRID' ? 'active pill-tab-btn-lime' : ''}`}
              onClick={() => setViewMode('GRID')}
            >
              <LayoutGrid size={15} />
              <span>Grid Kartu</span>
            </button>
          </div>

          <button
            className={`btn btn-sm ${soundEnabled ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{ borderRadius: '9999px', fontSize: '0.78rem' }}
            title={soundEnabled ? 'Suara notifikasi aktif' : 'Suara notifikasi dimatikan'}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{soundEnabled ? 'Suara: On' : 'Suara: Off'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchOrders()}
            disabled={isRefreshing}
            style={{ borderRadius: '9999px', fontSize: '0.78rem' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>

          {userRole === 'SUPER_ADMIN' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => router.push('/admin/pengaturan')}
              style={{ borderRadius: '9999px', fontSize: '0.78rem' }}
            >
              <Settings size={15} />
              <span>Poster QR</span>
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '9999px', fontSize: '0.78rem', color: '#dc2626' }}
            onClick={async () => {
              await fetch('/api/admin/logout', { method: 'POST' });
              router.push('/admin/login');
              router.refresh();
            }}
            title="Keluar dari sesi kasir"
          >
            <LogOut size={15} />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      <main className="container-wide" style={{ paddingTop: '1.25rem' }}>
        {/* ========================================================
            BENTO HEADER (3 KARTU WIDGET - GAYA GAMBAR 1 FINTECH)
            ======================================================== */}
        <section className="bento-header-grid">
          {/* Widget 1: Antrean Menunggu & Total Hari Ini (Obsidian Dark) */}
          <div className="bento-widget bento-widget-obsidian">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                  }}
                >
                  ● AKTIF
                </span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Volume Antrean</span>
              </div>
              <TrendingUp size={18} color="#a3e635" />
            </div>

            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
              {activeOrdersCount} <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#94a3b8' }}>Dokumen</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                Menunggu: <strong style={{ color: '#f59e0b' }}>{pendingOrders.length}</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>•</div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                Sedang Cetak: <strong style={{ color: '#38bdf8' }}>{printingOrders.length}</strong>
              </div>
            </div>
          </div>

          {/* Widget 2: Hero Lime Card 'Siap Diambil & Selesai' */}
          <div className="bento-widget bento-widget-lime">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <span
                style={{
                  background: '#0c1a14',
                  color: '#a3e635',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Sparkles size={12} /> PRIORITAS MEJA
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9999px',
                  background: 'rgba(12, 26, 20, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowRight size={16} color="#0c1a14" />
              </div>
            </div>

            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0c1a14', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
              {readyOrders.length} <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Siap Diambil</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(12, 26, 20, 0.15)' }}>
              <div style={{ fontSize: '0.78rem', color: '#1e3a2b', fontWeight: 700 }}>
                📦 Selesai Hari Ini: <strong>{completedOrders.length} Pesanan</strong>
              </div>
            </div>
          </div>

          {/* Widget 3: Status Toko & Pencarian Cepat */}
          <div className="bento-widget">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Store size={16} color="var(--primary)" />
                <span>Konektivitas Kios</span>
              </div>
              <span
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: settings.isOpen ? '#ecfdf5' : '#fef2f2',
                  color: settings.isOpen ? '#059669' : '#dc2626',
                }}
              >
                {settings.isOpen ? '● Menerima Order' : '● Tutup'}
              </span>
            </div>

            {/* Kotak Cari Cepat */}
            <div style={{ position: 'relative', marginTop: '0.5rem' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Cari nama pemesan, antrean, file..."
                className="text-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: '2.35rem',
                  borderRadius: '9999px',
                  fontSize: '0.825rem',
                  background: '#f8fafc',
                }}
              />
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
              💡 Tips: Geser kartu antar kolom untuk mengubah status dokumen seketika.
            </div>
          </div>
        </section>

        {/* ========================================================
            TAMPILAN 1: PAPAN KANBAN (DRAG & DROP MOTION)
            ======================================================== */}
        {viewMode === 'KANBAN' ? (
          <section className="kanban-container">
            {/* Kolom 1: Menunggu Cetak */}
            <div
              className={`kanban-col ${dragOverColumn === 'PENDING' ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'PENDING')}
              onDragLeave={(e) => handleDragLeave(e, 'PENDING')}
              onDrop={(e) => handleDrop(e, 'PENDING')}
            >
              <div className="kanban-col-header">
                <div className="kanban-col-title">
                  <Inbox size={17} color="#f59e0b" />
                  <span>1. Menunggu Cetak</span>
                </div>
                <span className="kanban-col-badge">{pendingOrders.length}</span>
              </div>

              {dragOverColumn === 'PENDING' && (
                <div className="drop-placeholder">Lepas Kartu di Sini (Menunggu)</div>
              )}

              {pendingOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8', fontSize: '0.825rem' }}>
                  Tidak ada antrean baru
                </div>
              ) : (
                pendingOrders
                  .filter((o) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      o.queueNumber.toLowerCase().includes(q) ||
                      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
                      o.files.some((f) => f.originalFilename.toLowerCase().includes(q))
                    );
                  })
                  .map((order) => renderOrderCard(order, true))
              )}
            </div>

            {/* Kolom 2: Sedang Diproses */}
            <div
              className={`kanban-col ${dragOverColumn === 'PRINTING' ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'PRINTING')}
              onDragLeave={(e) => handleDragLeave(e, 'PRINTING')}
              onDrop={(e) => handleDrop(e, 'PRINTING')}
            >
              <div className="kanban-col-header">
                <div className="kanban-col-title">
                  <Printer size={17} color="#0284c7" />
                  <span>2. Sedang Diproses</span>
                </div>
                <span className="kanban-col-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                  {printingOrders.length}
                </span>
              </div>

              {dragOverColumn === 'PRINTING' && (
                <div className="drop-placeholder" style={{ borderColor: '#0284c7', color: '#0284c7', background: 'rgba(2, 132, 199, 0.1)' }}>
                  Lepas Kartu (Otomatis Download Berkas)
                </div>
              )}

              {printingOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8', fontSize: '0.825rem' }}>
                  Tarik kartu ke sini saat mulai dicetak
                </div>
              ) : (
                printingOrders
                  .filter((o) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      o.queueNumber.toLowerCase().includes(q) ||
                      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
                      o.files.some((f) => f.originalFilename.toLowerCase().includes(q))
                    );
                  })
                  .map((order) => renderOrderCard(order, true))
              )}
            </div>

            {/* Kolom 3: Siap Diambil */}
            <div
              className={`kanban-col ${dragOverColumn === 'READY' ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'READY')}
              onDragLeave={(e) => handleDragLeave(e, 'READY')}
              onDrop={(e) => handleDrop(e, 'READY')}
            >
              <div className="kanban-col-header">
                <div className="kanban-col-title">
                  <CheckCircle2 size={17} color="#84cc16" />
                  <span>3. Siap Diambil</span>
                </div>
                <span className="kanban-col-badge" style={{ background: '#ecfccb', color: '#3f6212' }}>
                  {readyOrders.length}
                </span>
              </div>

              {dragOverColumn === 'READY' && (
                <div className="drop-placeholder">Lepas Kartu (Siap Di Meja Kasir)</div>
              )}

              {readyOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8', fontSize: '0.825rem' }}>
                  Tarik kartu ke sini saat cetakan selesai
                </div>
              ) : (
                readyOrders
                  .filter((o) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      o.queueNumber.toLowerCase().includes(q) ||
                      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
                      o.files.some((f) => f.originalFilename.toLowerCase().includes(q))
                    );
                  })
                  .map((order) => renderOrderCard(order, true))
              )}
            </div>

            {/* Kolom 4: Selesai */}
            <div
              className={`kanban-col ${dragOverColumn === 'COMPLETED' ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'COMPLETED')}
              onDragLeave={(e) => handleDragLeave(e, 'COMPLETED')}
              onDrop={(e) => handleDrop(e, 'COMPLETED')}
            >
              <div className="kanban-col-header">
                <div className="kanban-col-title">
                  <CheckCheck size={17} color="#64748b" />
                  <span>4. Selesai (Arsip)</span>
                </div>
                <span className="kanban-col-badge">{completedOrders.length}</span>
              </div>

              {dragOverColumn === 'COMPLETED' && (
                <div className="drop-placeholder" style={{ borderColor: '#64748b', color: '#64748b', background: 'rgba(100, 116, 139, 0.1)' }}>
                  Lepas Kartu untuk Menyelesaikan
                </div>
              )}

              {completedOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8', fontSize: '0.825rem' }}>
                  Pesanan selesai akan masuk ke sini
                </div>
              ) : (
                completedOrders
                  .filter((o) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      o.queueNumber.toLowerCase().includes(q) ||
                      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
                      o.files.some((f) => f.originalFilename.toLowerCase().includes(q))
                    );
                  })
                  .slice(0, 10)
                  .map((order) => renderOrderCard(order, true))
              )}
            </div>
          </section>
        ) : (
          /* ========================================================
             TAMPILAN 2: GRID KARTU BENTO (TRADISIONAL CEPAT)
             ======================================================== */
          <section>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
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
                  style={{ borderRadius: '9999px', fontSize: '0.8rem' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                Memuat antrean...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '4rem 1rem',
                  background: '#ffffff',
                  borderRadius: '24px',
                  border: '1px dashed #cbd5e1',
                }}
              >
                <CheckCircle2 size={44} color="#84cc16" style={{ margin: '0 auto 0.75rem' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Tidak ada dokumen pada filter ini</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Dokumen dari pelanggan akan langsung muncul secara otomatis.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
                {filteredOrders.map((order) => renderOrderCard(order, false))}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
