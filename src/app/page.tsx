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
  User,
  Plus,
  Clock,
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
  const [customerName, setCustomerName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Cek pesanan aktif & nama pelanggan di localStorage & verifikasi status ke server
  useEffect(() => {
    try {
      const cachedName = localStorage.getItem('fc_customer_name');
      if (cachedName) setCustomerName(cachedName);
    } catch {
      // ignore
    }

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

  // 2. Validasi & Tambah File (mendukung klik & drag-and-drop)
  const processIncomingFiles = (incomingList: File[]) => {
    if (!settings.isOpen) {
      setErrorMessage('Mohon maaf, toko sedang tutup sementara waktu.');
      return;
    }

    setErrorMessage('');
    const maxFiles = settings.maxFilesPerOrder || 10;
    const isCloudStorage = settings.storageProvider === 'gdrive' || settings.storageProvider === 'r2';
    const safeMaxMb = isCloudStorage ? (settings.maxFileSizeMb || 100) : Math.min(settings.maxFileSizeMb || 25, 25);
    const maxBytes = safeMaxMb * 1024 * 1024;

    if (files.length + incomingList.length > maxFiles) {
      setErrorMessage(`Maksimal ${maxFiles} file per pesanan.`);
      return;
    }

    const processedFiles: SelectedFileItem[] = [];

    for (const f of incomingList) {
      if (f.size > maxBytes) {
        setErrorMessage(`File "${f.name}" melebihi batas ukuran ${safeMaxMb} MB.`);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    processIncomingFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!settings.isOpen || isUploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!settings.isOpen || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // 3. Kirim Dokumen ke Kasir (Mendukung Google Drive Chunked Upload & R2)
  const handleSubmit = async () => {
    if (!settings.isOpen) {
      setErrorMessage('Mohon maaf, toko sedang tutup sementara waktu.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Silakan isi Nama Pemesan agar kasir dapat memanggil Anda.');
      return;
    }

    if (files.length === 0) {
      setErrorMessage('Pilih minimal 1 file dokumen.');
      return;
    }

    try {
      localStorage.setItem('fc_customer_name', customerName.trim());
    } catch {
      // ignore
    }

    setIsUploading(true);
    setUploadProgress(5);
    setErrorMessage('');

    try {
      const uploadedFiles = [];
      const totalSteps = files.length;

      for (let i = 0; i < files.length; i++) {
        const item = files[i];

        // Minta Presigned URL / Provider config
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

        const presignData = await presignRes.json();

        if (presignData.provider === 'gdrive') {
          // 1. Minta sessionUri aman dari server
          const initRes = await fetch('/api/upload/gdrive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: item.originalFilename,
              fileType: item.fileType,
              fileSize: item.fileSizeBytes,
            }),
          });

          if (!initRes.ok) {
            const err = await initRes.json();
            throw new Error(err.error || `Gagal menyiapkan upload Google Drive untuk ${item.originalFilename}`);
          }

          const { sessionUri } = await initRes.json();
          // Chunk size 8 MB (32 * 256 KiB) untuk kecepatan maksimal & request minimal
          const CHUNK_SIZE = 8 * 1024 * 1024;
          const totalBytes = item.fileSizeBytes;
          let offset = 0;
          let finalFileId = '';

          while (offset < totalBytes) {
            const nextOffset = Math.min(offset + CHUNK_SIZE, totalBytes);
            const chunkBlob = item.file.slice(offset, nextOffset);
            const contentRange = `bytes ${offset}-${nextOffset - 1}/${totalBytes}`;

            // Upload LANGSUNG dari browser ke Google Drive (Direct-to-Google tanpa perantara Netlify)
            const chunkRes = await fetch(sessionUri, {
              method: 'PUT',
              headers: {
                'Content-Range': contentRange,
              },
              body: chunkBlob,
            });

            if (chunkRes.status === 200 || chunkRes.status === 201) {
              const chunkData = await chunkRes.json();
              finalFileId = chunkData.id;
              offset = totalBytes;
              break;
            } else if (chunkRes.status === 308) {
              offset = nextOffset;
            } else {
              const errText = await chunkRes.text();
              throw new Error(`Gagal mengirim data ke Google Drive (${chunkRes.status}): ${errText}`);
            }

            // Progres upload yang halus
            const filePercent = offset / totalBytes;
            const overallProgress = Math.round(((i + filePercent) / totalSteps) * 85);
            setUploadProgress(overallProgress);
          }

          // Pastikan permission publik aktif untuk unduhan kasir
          if (finalFileId) {
            fetch('/api/upload/gdrive', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: finalFileId }),
            }).catch(() => {});
          }

          uploadedFiles.push({
            originalFilename: item.originalFilename,
            storageKey: `gdrive:${finalFileId}`,
            fileType: item.fileType,
            fileSizeBytes: item.fileSizeBytes,
          });
        } else {
          // Fallback ke Cloudflare R2 / Database
          const { uploadUrl, storageKey } = presignData;
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
      }

      // Buat Pesanan di Backend
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: uploadedFiles,
          customerName: customerName.trim(),
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

  const totalSizeMb = (
    files.reduce((acc, item) => acc + item.fileSizeBytes, 0) /
    (1024 * 1024)
  ).toFixed(2);

  const maxFiles = settings.maxFilesPerOrder || 10;
  const isCloudStorage = settings.storageProvider === 'gdrive' || settings.storageProvider === 'r2';
  const displayMaxMb = isCloudStorage ? (settings.maxFileSizeMb || 100) : Math.min(settings.maxFileSizeMb || 25, 25);

  return (
    <div className="customer-viewport">
      {/* Input File Tersembunyi (Selalu Terpasang) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        disabled={!settings.isOpen || isUploading}
        onChange={handleFileSelect}
      />

      {/* Top Bar Clean & Profesional */}
      <header className="customer-topbar">
        <div className="customer-topbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div className="brand-icon">
              <Printer size={17} />
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: '0.95rem',
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              {settings.storeName}
            </span>
          </div>

          <span
            style={{
              fontSize: '0.775rem',
              fontWeight: 600,
              color: settings.isOpen ? '#059669' : '#dc2626',
              letterSpacing: '-0.01em',
            }}
          >
            {settings.isOpen ? 'Buka · Menerima Cetak' : 'Tutup Sementara'}
          </span>
        </div>
      </header>

      {/* Main Container Tanpa Scroll Halaman */}
      <main className="customer-main">
        {/* Banner Pesanan Aktif (Kompak 1 Baris) */}
        {activeOrder && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.825rem' }}>
              <span style={{ color: '#1e40af', fontWeight: 500 }}>Antrean Aktif:</span>
              <strong
                style={{
                  color: '#1d4ed8',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {activeOrder.queueNumber}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/status/${activeOrder.trackingCode}`)}
              style={{
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                cursor: 'pointer',
              }}
            >
              Lihat Status <ChevronRight size={13} />
            </button>
          </div>
        )}

        {/* Banner Peringatan Saat Toko Tutup */}
        {!settings.isOpen && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              padding: '0.6rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: '#92400e',
              fontSize: '0.8rem',
              flexShrink: 0,
            }}
          >
            <Clock size={17} color="#d97706" style={{ flexShrink: 0 }} />
            <div style={{ lineHeight: 1.35 }}>
              <strong style={{ color: '#78350f' }}>Toko Sedang Tutup:</strong> Pengiriman dokumen dinonaktifkan sementara hingga kasir membuka antrean.
            </div>
          </div>
        )}

        {/* Panel Utama Terpadu */}
        <section className="customer-panel">
          {/* Header Panel */}
          <div style={{ marginBottom: '0.85rem', flexShrink: 0 }}>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
                marginBottom: '0.15rem',
              }}
            >
              Kirim Dokumen Cetak
            </h1>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Isi nama panggilan dan unggah dokumen untuk mendapatkan nomor antrean kasir.
            </p>
          </div>

          {/* Error Alert Kompak */}
          {errorMessage && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '0.55rem 0.75rem',
                color: '#dc2626',
                marginBottom: '0.75rem',
                fontSize: '0.8rem',
                display: 'flex',
                gap: '0.45rem',
                alignItems: 'center',
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Input Nama Pemesan */}
          <div
            style={{
              marginBottom: '0.85rem',
              flexShrink: 0,
              opacity: settings.isOpen ? 1 : 0.6,
            }}
          >
            <label
              htmlFor="customerNameInput"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} color="var(--primary)" />
                Nama Pemesan / Panggilan <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                Untuk panggilan di kasir
              </span>
            </label>
            <input
              id="customerNameInput"
              type="text"
              className="text-input"
              placeholder="Contoh: Budi, Rina, Dimas..."
              value={customerName}
              maxLength={40}
              disabled={!settings.isOpen || isUploading}
              onChange={(e) => {
                setCustomerName(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              style={{
                fontSize: '0.925rem',
                fontWeight: 500,
                height: '42px',
                padding: '0 0.75rem',
                borderRadius: '10px',
              }}
            />
          </div>

          {/* Area Dokumen Adaptif (Dropzone Kosong ATAU Daftar File Scroll Internal) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              marginBottom: '0.85rem',
            }}
          >
            {files.length === 0 ? (
              <div
                className={`dropzone ${isDragging ? 'active' : ''} ${!settings.isOpen ? 'disabled' : ''}`}
                onClick={() => {
                  if (settings.isOpen && !isUploading) {
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  flex: 1,
                  minHeight: '140px',
                  padding: '1.25rem 1rem',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  borderRadius: '12px',
                }}
              >
                <div
                  className="dropzone-icon"
                  style={{ width: '44px', height: '44px', marginBottom: '0.1rem' }}
                >
                  <UploadCloud size={22} />
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.015em',
                    }}
                  >
                    {isDragging ? 'Lepaskan File di Sini' : 'Ketuk untuk Pilih Dokumen atau Foto'}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    PDF, Word (DOC/DOCX), JPG, PNG · Maks. {displayMaxMb} MB/file
                  </div>
                </div>
                <span
                  style={{
                    marginTop: '0.25rem',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    background: '#eff6ff',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '8px',
                  }}
                >
                  Jelajahi Perangkat
                </span>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  border: isDragging ? '1.5px dashed var(--primary)' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  padding: '0.65rem 0.75rem',
                  overflow: 'hidden',
                }}
              >
                {/* Header Daftar File */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '0.5rem',
                    marginBottom: '0.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Dokumen ({files.length}/{maxFiles})
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.35rem' }}>
                      · {totalSizeMb} MB
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {files.length < maxFiles && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!settings.isOpen || isUploading}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--primary)',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '0.25rem 0.55rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={13} /> Tambah
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      disabled={isUploading}
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: '#dc2626',
                        background: '#ffffff',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        padding: '0.25rem 0.55rem',
                        cursor: 'pointer',
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Scrollable List Internal */}
                <div className="customer-scroll-list">
                  {files.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.6rem',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        gap: '0.5rem',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          overflow: 'hidden',
                          flex: 1,
                        }}
                      >
                        {item.fileType.includes('image') ? (
                          <ImageIcon size={17} color="var(--primary)" style={{ flexShrink: 0 }} />
                        ) : (
                          <FileText size={17} color="var(--primary)" style={{ flexShrink: 0 }} />
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
                            {item.originalFilename}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {(item.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB · File #{idx + 1}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFile(item.id)}
                        disabled={isUploading}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          flexShrink: 0,
                        }}
                        title="Hapus file ini"
                        aria-label={`Hapus ${item.originalFilename}`}
                      >
                        <Trash2 size={15} color="#dc2626" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tombol Aksi Utama (Selalu Terlihat Tanpa Scroll) */}
          <div style={{ flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isUploading || !settings.isOpen || files.length === 0}
              style={{
                width: '100%',
                height: '46px',
                fontSize: '0.95rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                borderRadius: '10px',
                gap: '0.5rem',
                opacity: !settings.isOpen || isUploading || files.length === 0 ? 0.55 : 1,
                cursor:
                  !settings.isOpen || isUploading || files.length === 0
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {isUploading ? (
                <span>Mengirim Dokumen ({uploadProgress}%)...</span>
              ) : (
                <>
                  <Send size={16} />
                  <span>
                    {files.length > 0
                      ? `Kirim ke Kasir Sekarang (${files.length} Dokumen)`
                      : 'Pilih Dokumen untuk Mengirim'}
                  </span>
                </>
              )}
            </button>

            {isUploading && (
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>
        </section>

        {/* Footer Jaminan Privasi (Ringkas 1 Baris) */}
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            flexShrink: 0,
            padding: '0.15rem 0',
          }}
        >
          <ShieldCheck size={15} color="#059669" style={{ flexShrink: 0 }} />
          <span>Privasi terjaga · Dokumen otomatis terhapus permanen dalam 24 jam.</span>
        </footer>
      </main>
    </div>
  );
}
