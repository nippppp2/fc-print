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

    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

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
        setSuccessMsg('Pengaturan toko berhasil disimpan!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert('Gagal menyimpan pengaturan');
      }
    } catch {
      alert('Terjadi kesalahan sistem');
    } finally {
      setSaving(false);
    }
  };

  const printQrPoster = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        Memuat pengaturan...
      </div>
    );
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
    appUrl || 'http://localhost:3000'
  )}`;

  return (
    <>
      <header className="navbar">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => router.push('/admin')}
        >
          <ArrowLeft size={16} /> Kembali ke Antrean
        </button>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>Pengaturan & Poster QR Toko</div>
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
          <LogOut size={16} /> Keluar
        </button>
      </header>

      <main className="container" style={{ maxWidth: '720px' }}>
        {successMsg && (
          <div
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
            }}
          >
            <CheckCircle2 size={18} color="#059669" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Profil & Operasional Toko</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div className="option-group">
                <label className="option-label">Nama Toko</label>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="option-group">
                <label className="option-label">Batas Ukuran per File (MB)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="text-input"
                  value={settings.maxFileSizeMb}
                  onChange={(e) => handleChange('maxFileSizeMb', parseInt(e.target.value) || 25)}
                />
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

            <div className="option-group" style={{ marginTop: '1rem' }}>
              <label className="option-label">PIN Keamanan Kasir (4–8 Digit)</label>
              <input
                type="text"
                maxLength={10}
                className="text-input"
                style={{ fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.15em', maxWidth: '240px' }}
                value={settings.adminPin || '1234'}
                onChange={(e) => handleChange('adminPin', e.target.value)}
                placeholder="1234"
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                PIN ini digunakan kasir saat membuka halaman antrean toko. Default: <strong>1234</strong>.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </section>
        </form>

        {/* Poster QR Toko Siap Cetak */}
        <section className="card" style={{ background: '#f8fafc', marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">
              <QrCode size={20} color="var(--primary)" /> Poster QR Meja Kasir (Siap Cetak)
            </h2>
            <button type="button" className="btn btn-primary btn-sm" onClick={printQrPoster}>
              <Printer size={16} /> Cetak Poster QR
            </button>
          </div>

          <div
            id="printable-poster"
            style={{
              background: 'white',
              border: '2px solid #cbd5e1',
              borderRadius: 'var(--radius-lg)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              maxWidth: '460px',
              margin: '1rem auto',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'var(--primary)' }}>
              Scan untuk Kirim Dokumen Cetak
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0.35rem 0 1rem', color: 'var(--text-primary)' }}>
              {settings.storeName}
            </h1>

            {/* QR Code */}
            <div
              style={{
                display: 'inline-block',
                padding: '1rem',
                background: 'white',
                border: '2px dashed var(--primary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="QR Code Toko"
                width={260}
                height={260}
                style={{ display: 'block' }}
              />
            </div>

            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Kirim Dokumen Cepat Tanpa Simpan Nomor WA:
            </div>
            <div style={{ textAlign: 'left', display: 'inline-block', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>1. Pindai QR ini dengan kamera HP</div>
              <div>2. Pilih dokumen/foto yang ingin dicetak</div>
              <div>3. Tunjukkan nomor antrean ke kasir</div>
            </div>

            <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              URL: {appUrl}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
