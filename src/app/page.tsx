'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  Printer,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Send,
} from 'lucide-react';
import { StoreSettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

interface SelectedFileItem {
  file: File;
  id: string;
  originalFilename: string;
  fileSizeBytes: number;
  fileType: string;
}

export default function CustomerUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [activeOrder, setActiveOrder] = useState<{ queueNumber: string; trackingCode: string } | null>(null);

  const [files, setFiles] = useState<SelectedFileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Cek pesanan aktif di localStorage & verifikasi status ke server
  useEffect(() => {
    try {
      const saved = localStorage.getItem('active_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Verifikasi apakah pesanan masih aktif di server
        fetch(`/api/orders/${parsed.trackingCode}`)
          .then((res) => {
            if (!res.ok) throw new Error('Not found');
            return res.json();
          })
          .then((data) => {
            if (
              !data.order ||
              data.order.status === 'COMPLETED' ||
              data.order.status === 'CANCELLED'
            ) {
              // Jika sudah selesai atau dibatalkan, bersihkan dari penyimpanan
              localStorage.removeItem('active_order');
              setActiveOrder(null);
            } else {
              setActiveOrder(parsed);
            }
          })
          .catch(() => {
            localStorage.removeItem('active_order');
            setActiveOrder(null);
          });
      }
    } catch {
      localStorage.removeItem('active_order');
    }

    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {});
  }, []);

  // 2. Handle Pemilihan File
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setErrorMessage('');

    const newFilesList = Array.from(e.target.files);
    const maxFiles = settings.maxFilesPerOrder || 10;
    const maxBytes = (settings.maxFileSizeMb || 25) * 1024 * 1024;

    if (files.length + newFilesList.length > maxFiles) {
      setErrorMessage(`Maksimal ${maxFiles} file per pesanan.`);
      return;
    }

    const processedFiles: SelectedFileItem[] = [];

    for (const f of newFilesList) {
      if (f.size > maxBytes) {
        setErrorMessage(`File "${f.name}" melebihi batas ukuran ${settings.maxFileSizeMb} MB.`);
        return;
      }

      const ext = f.name.split('.').pop()?.toLowerCase();
      const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
      if (!ext || !allowedExts.includes(ext)) {
        setErrorMessage(`File "${f.name}" format tidak didukung. Gunakan PDF, Word, atau Gambar.`);
        return;
      }

      processedFiles.push({
        file: f,
        id: Math.random().toString(36).substring(2, 9),
        originalFilename: f.name,
        fileSizeBytes: f.size,
        fileType: f.type || 'application/octet-stream',
      });
    }

    setFiles((prev) => [...prev, ...processedFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // 3. Kirim Langsung Dokumen ke Admin via Presigned Upload R2
  const handleSubmit = async () => {
    if (files.length === 0) {
      setErrorMessage('Pilih minimal 1 file dokumen.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setErrorMessage('');

    try {
      const uploadedFiles = [];
      const totalSteps = files.length;

      for (let i = 0; i < files.length; i++) {
        const item = files[i];

        // Minta Presigned URL
        const presignRes = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: item.originalFilename,
            fileType: item.fileType,
          }),
        });

        if (!presignRes.ok) {
          throw new Error(`Gagal mempersiapkan unggahan untuk ${item.originalFilename}`);
        }

        const { uploadUrl, storageKey } = await presignRes.json();

        // Upload langsung payload ke R2
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': item.fileType },
          body: item.file,
        });

        if (!putRes.ok) {
          throw new Error(`Gagal mengunggah file ${item.originalFilename}`);
        }

        uploadedFiles.push({
          originalFilename: item.originalFilename,
          storageKey,
          fileType: item.fileType,
          fileSizeBytes: item.fileSizeBytes,
        });

        setUploadProgress(Math.round(((i + 1) / totalSteps) * 85));
      }

      // Buat Pesanan di Backend
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: uploadedFiles,
        }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json();
        throw new Error(errData.error || 'Gagal mengirim dokumen');
      }

      const orderData = await orderRes.json();
      setUploadProgress(100);

      // Simpan riwayat sesi aktif di localStorage
      localStorage.setItem(
        'active_order',
        JSON.stringify({
          queueNumber: orderData.queueNumber,
          trackingCode: orderData.trackingCode,
        })
      );

      // Alihkan langsung ke halaman nomor antrean
      router.push(`/status/${orderData.trackingCode}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setErrorMessage(msg);
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Navbar Minimalis */}
      <header className="navbar">
        <div className="navbar-brand">
          <div className="brand-icon">
            <Printer size={20} />
          </div>
          <div>
            <div style={{ lineHeight: 1.2, fontWeight: 700 }}>{settings.storeName}</div>
            <div style={{ fontSize: '0.75rem', color: settings.isOpen ? '#059669' : '#dc2626', fontWeight: 600 }}>
              {settings.isOpen ? '● Menerima Cetak' : '● Sedang Tutup'}
            </div>
          </div>
        </div>
      </header>

      <main className="container" style={{ maxWidth: '600px' }}>
        {/* Banner Pesanan Aktif (Jika Ada) */}
        {activeOrder && (
          <div className="active-order-banner">
            <div>
              <div style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>
                Pesanan Anda Sedang Berjalan:
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1d4ed8' }}>
                Antrean {activeOrder.queueNumber}
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push(`/status/${activeOrder.trackingCode}`)}
            >
              Lihat Status <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Hero Title */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            Kirim Dokumen Cetak
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Pilih file dokumen atau foto Anda, lalu kirim langsung ke antrean kasir.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-md)',
              padding: '0.875rem',
              color: '#dc2626',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Area Pilih Dokumen */}
        <div
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
          style={{ marginBottom: '1.5rem', padding: '2.5rem 1.5rem' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <div className="dropzone-icon">
            <UploadCloud size={32} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              Pilih Dokumen dari HP
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Mendukung PDF, Word (DOCX), dan Foto (Maks. {settings.maxFileSizeMb} MB)
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
            Jelajahi File
          </button>
        </div>

        {/* Daftar File Terpilih */}
        {files.length > 0 && (
          <section className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>
                Dokumen Dipilih ({files.length})
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setFiles([])}
                style={{ fontSize: '0.75rem' }}
              >
                Hapus Semua
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
              {files.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', overflow: 'hidden' }}>
                    {item.fileType.includes('image') ? (
                      <ImageIcon size={22} color="var(--primary)" />
                    ) : (
                      <FileText size={22} color="var(--primary)" />
                    )}
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          maxWidth: '280px',
                        }}
                      >
                        {item.originalFilename}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {(item.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB • File #{idx + 1}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.25rem' }}
                    title="Hapus file ini"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* Tombol Kirim Langsung */}
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={isUploading}
              style={{ width: '100%', fontSize: '1.05rem', gap: '0.625rem' }}
            >
              {isUploading ? (
                <span>Mengirim Dokumen ({uploadProgress}%)...</span>
              ) : (
                <>
                  <Send size={18} />
                  <span>Kirim ke Kasir Sekarang ({files.length} File)</span>
                </>
              )}
            </button>

            {isUploading && (
              <div className="progress-bar-container" style={{ marginTop: '0.75rem' }}>
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </section>
        )}

        {/* Jaminan Privasi */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.75rem 1rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginTop: '1.5rem',
          }}
        >
          <ShieldCheck size={22} color="#059669" style={{ flexShrink: 0 }} />
          <div>
            <strong>Privasi Aman:</strong> Dokumen Anda langsung masuk ke kasir dan{' '}
            <strong>otomatis terhapus permanen dalam 24 jam</strong>.
          </div>
        </div>
      </main>
    </>
  );
}
