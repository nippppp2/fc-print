'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  QrCode,
  Printer,
  CheckCircle2,
  LogOut,
  Download,
  Shield,
  KeyRound,
  Store,
  Smartphone,
  FileCheck2,
  ReceiptText,
} from 'lucide-react';
import { StoreSettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

export default function AdminSettingsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
    }

    // 1. Cek hak akses Super Admin
    fetch('/api/admin/session')
      .then((res) => {
        if (!res.ok) {
          router.push('/admin/login');
          return null;
        }
        return res.json();
      })
      .then((session) => {
        if (session && session.role !== 'SUPER_ADMIN') {
          alert('Akses Ditolak: Halaman Pengaturan hanya dapat diakses oleh Super Admin.');
          router.push('/admin');
          return;
        }

        // 2. Ambil data pengaturan
        fetch('/api/admin/settings')
          .then((res) => res.json())
          .then((data) => {
            if (data.settings) {
              setSettings({
                ...DEFAULT_SETTINGS,
                ...data.settings,
                kasirPin: data.settings.kasirPin || data.settings.adminPin || '1234',
                superAdminPin: data.settings.superAdminPin || '9999',
              });
            }
          })
          .catch((err) => console.error(err))
          .finally(() => setLoading(false));
      })
      .catch(() => {
        router.push('/admin/login');
      });
  }, [router]);

  const handleChange = <K extends keyof StoreSettings>(key: K, val: StoreSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSuccessMsg('Pengaturan toko & PIN keamanan berhasil disimpan!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menyimpan pengaturan');
      }
    } catch {
      alert('Terjadi kesalahan sistem saat menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(
    appUrl || 'https://fcsejahtera.netlify.app'
  )}`;

  const handleDownloadQrOnly = () => {
    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `QR_${settings.storeName.replace(/\s+/g, '_')}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem', color: '#64748b' }}>
        Memeriksa hak akses Super Admin...
      </div>
    );
  }

  return (
    <>
      <header className="navbar no-print">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => router.push('/admin')}
        >
          <ArrowLeft size={16} /> Kembali ke Antrean
        </button>
        <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>👑 Pengaturan Toko & Poster (Super Admin)</span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ color: '#dc2626' }}
          onClick={async () => {
            await fetch('/api/admin/logout', { method: 'POST' });
            router.push('/admin/login');
            router.refresh();
          }}
          title="Keluar dari sesi Super Admin"
        >
          <LogOut size={16} /> Keluar
        </button>
      </header>

      <main className="container" style={{ maxWidth: '780px' }}>
        {successMsg && (
          <div
            className="no-print"
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 'var(--radius-md)',
              padding: '0.875rem 1rem',
              color: '#065f46',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            <CheckCircle2 size={18} color="#059669" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Pengaturan Toko & PIN */}
        <form onSubmit={handleSave} className="no-print">
          <section className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={20} color="var(--primary)" /> Profil & Operasional Toko
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div className="option-group">
                <label className="option-label">Nama Toko (Tampil di Header & Poster)</label>
                <input
                  type="text"
                  className="text-input"
                  value={settings.storeName}
                  onChange={(e) => handleChange('storeName', e.target.value)}
                  required
                />
              </div>

              <div className="option-group">
                <label className="option-label">Status Toko</label>
                <select
                  className="select-input"
                  value={settings.isOpen ? 'true' : 'false'}
                  onChange={(e) => handleChange('isOpen', e.target.value === 'true')}
                >
                  <option value="true">Buka (Menerima Pengiriman Dokumen)</option>
                  <option value="false">Tutup Sementara (Nonaktifkan Pengiriman)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="option-group">
                <label className="option-label">
                  Batas Ukuran per Dokumen (MB)
                  {settings.storageProvider === 'gdrive' && (
                    <span style={{ marginLeft: '0.5rem', color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>
                      ● Google Drive Aktif
                    </span>
                  )}
                  {settings.storageProvider === 'r2' && (
                    <span style={{ marginLeft: '0.5rem', color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>
                      ● Cloudflare R2 Aktif
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min={1}
                  max={settings.storageProvider === 'gdrive' || settings.storageProvider === 'r2' ? 500 : 25}
                  className="text-input"
                  value={
                    settings.storageProvider === 'gdrive' || settings.storageProvider === 'r2'
                      ? settings.maxFileSizeMb || 100
                      : Math.min(settings.maxFileSizeMb || 25, 25)
                  }
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 25;
                    const maxAllowed = settings.storageProvider === 'gdrive' || settings.storageProvider === 'r2' ? 500 : 25;
                    handleChange('maxFileSizeMb', Math.min(Math.max(val, 1), maxAllowed));
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {settings.storageProvider === 'gdrive' ? (
                    <span>Tersimpan langsung ke <strong>Google Drive Toko</strong>. Mendukung file besar (hingga 500 MB).</span>
                  ) : settings.storageProvider === 'r2' ? (
                    <span>Tersimpan ke <strong>Cloudflare R2</strong>. Mendukung file besar hingga 500 MB.</span>
                  ) : (
                    <span>Mode Database bawaan: Maks. <strong>25 MB</strong> per file. Pasang Google Drive untuk berkas besar tanpa batas.</span>
                  )}
                </div>
              </div>

              <div className="option-group">
                <label className="option-label">Maksimal Dokumen per Kiriman</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="text-input"
                  value={settings.maxFilesPerOrder}
                  onChange={(e) => handleChange('maxFilesPerOrder', parseInt(e.target.value) || 10)}
                />
              </div>
            </div>

            {/* Bagian Manajemen PIN Keamanan */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <KeyRound size={18} color="var(--primary)" /> Keamanan Hak Akses & PIN
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {/* PIN Kasir */}
                <div className="option-group">
                  <label className="option-label">PIN Akses Kasir (Operasional Harian)</label>
                  <input
                    type="text"
                    maxLength={10}
                    className="text-input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, letterSpacing: '0.15em' }}
                    value={settings.kasirPin || '1234'}
                    onChange={(e) => handleChange('kasirPin', e.target.value)}
                    placeholder="1234"
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Diberikan kepada staf kasir untuk melihat antrean & mulai print dokumen. (Default: <strong>1234</strong>)
                  </div>
                </div>

                {/* PIN Super Admin */}
                <div className="option-group">
                  <label className="option-label">PIN Master Super Admin (Pemilik Toko)</label>
                  <input
                    type="text"
                    maxLength={10}
                    className="text-input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, letterSpacing: '0.15em', borderColor: '#3b82f6' }}
                    value={settings.superAdminPin || '9999'}
                    onChange={(e) => handleChange('superAdminPin', e.target.value)}
                    placeholder="9999"
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: '#1d4ed8', marginTop: '0.35rem', fontWeight: 500 }}>
                    PIN rahasia pemilik toko untuk membuka halaman pengaturan ini. (Default: <strong>9999</strong>)
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan & PIN'}
              </button>
            </div>
          </section>
        </form>

        {/* ========================================================
            POSTER QR MEJA KASIR (TENT CARD / A5 AKRILIK MEJA)
           ======================================================== */}
        <section className="card print-target" style={{ background: '#f8fafc' }}>
          <div className="card-header no-print">
            <div>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={20} color="var(--primary)" /> Kartu Meja QR Toko (Standee A5)
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Didesain khusus untuk dicetak dan diselipkan ke standee akrilik meja kasir ukuran A5.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadQrOnly}
                title="Unduh file gambar QR Code"
              >
                <Download size={16} /> Unduh QR (.PNG)
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handlePrint}
                title="Cetak langsung ke printer"
              >
                <Printer size={16} /> Cetak Kartu Meja (A5)
              </button>
            </div>
          </div>

          {/* TEMPLATE POSTER / TENT CARD MEJA A5 */}
          <div
            id="printable-poster"
            style={{
              background: '#ffffff',
              border: '3px solid #0f172a',
              borderRadius: '20px',
              padding: '1.75rem 1.5rem',
              textAlign: 'center',
              maxWidth: '480px',
              margin: '1rem auto',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              color: '#0f172a',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {/* Top Badge */}
            <div
              style={{
                display: 'inline-block',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 900,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '0.35rem 1rem',
                borderRadius: '9999px',
                marginBottom: '0.75rem',
              }}
            >
              ★ PRINT MANDIRI VIA QR ★
            </div>

            {/* Nama Toko */}
            <h1
              style={{
                fontSize: '1.85rem',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                margin: '0.25rem 0',
                color: '#0f172a',
                textTransform: 'uppercase',
              }}
            >
              {settings.storeName}
            </h1>

            <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, marginBottom: '1.25rem' }}>
              Kirim File Cetak Langsung dari HP ke Mesin Kasir
            </p>

            {/* Frame QR Code Utama */}
            <div
              style={{
                display: 'inline-block',
                padding: '1rem',
                background: '#ffffff',
                border: '3px solid #2563eb',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
                marginBottom: '0.75rem',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt={`QR Code ${settings.storeName}`}
                width={240}
                height={240}
                style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}
              />
            </div>

            {/* Link Alamat Website */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                fontWeight: 800,
                color: '#2563eb',
                marginBottom: '1.25rem',
              }}
            >
              {appUrl ? appUrl.replace(/^https?:\/\//, '') : 'fcsejahtera.netlify.app'}
            </div>

            {/* 3 Langkah Mudah */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '0.85rem 0.75rem',
                marginBottom: '1rem',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', textAlign: 'center' }}>
                3 Langkah Cepat & Praktis:
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                <div style={{ padding: '0.4rem 0.2rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.35rem', fontWeight: 800, fontSize: '0.85rem' }}>
                    1
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>Scan QR</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Buka kamera HP</div>
                </div>

                <div style={{ padding: '0.4rem 0.2rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.35rem', fontWeight: 800, fontSize: '0.85rem' }}>
                    2
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>Upload File</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>PDF, Docx, Foto</div>
                </div>

                <div style={{ padding: '0.4rem 0.2rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.35rem', fontWeight: 800, fontSize: '0.85rem' }}>
                    3
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>Ambil di Kasir</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Sebut no. antrean</div>
                </div>
              </div>
            </div>

            {/* Format File Didukung */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                📄 PDF
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                📝 Word (DOCX)
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                🖼️ JPG / PNG
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                (Maks. {settings.maxFileSizeMb} MB)
              </span>
            </div>

            {/* Footer Notice */}
            <div style={{ fontSize: '0.7rem', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', fontWeight: 600 }}>
              ⚡ Cepat & Mandiri • Tidak Perlu Simpan Nomor WhatsApp
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
