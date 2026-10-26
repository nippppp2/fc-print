'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Eye, EyeOff, Delete, ArrowLeft, Lock, Loader2 } from 'lucide-react';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/admin';

  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleKeypadPress = (val: string) => {
    setError('');
    if (val === 'CLEAR') {
      setPin('');
    } else if (val === 'BACK') {
      setPin((prev) => prev.slice(0, -1));
    } else {
      if (pin.length < 8) {
        setPin((prev) => prev + val);
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError('Masukkan PIN kasir');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'PIN Kasir salah! Silakan coba lagi.');
      }

      router.push(redirectPath);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PIN salah atau gagal verifikasi';
      setError(msg);
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'rgba(30, 41, 59, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '2.25rem 1.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          color: '#ffffff',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.5)',
              color: '#ffffff',
            }}
          >
            <ShieldCheck size={34} />
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              marginBottom: '0.35rem',
            }}
          >
            Portal Kasir & Admin
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
            Masukkan PIN toko untuk mengakses antrean & dokumen
          </p>
        </div>

        {/* Input PIN Display */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                placeholder="••••"
                autoFocus
                style={{
                  width: '100%',
                  textAlign: 'center',
                  letterSpacing: '0.35em',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: error ? '2px solid #ef4444' : '1px solid #334155',
                  color: '#ffffff',
                  borderRadius: '16px',
                  padding: '0.85rem 2.75rem',
                  outline: 'none',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
                  transition: 'border-color 0.2s',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
              >
                {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {error && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.65rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#fca5a5',
                  fontSize: '0.8rem',
                  textAlign: 'center',
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Virtual Touch Keypad */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.65rem',
              marginBottom: '1.25rem',
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num.toString())}
                style={{
                  height: '52px',
                  background: 'rgba(51, 65, 85, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  color: '#ffffff',
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
                onMouseDown={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#2563eb';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)';
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(51, 65, 85, 0.6)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress('CLEAR')}
              style={{
                height: '52px',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                color: '#fbbf24',
                fontSize: '0.85rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              CLEAR
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              style={{
                height: '52px',
                background: 'rgba(51, 65, 85, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                color: '#ffffff',
                fontSize: '1.35rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#2563eb';
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(51, 65, 85, 0.6)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('BACK')}
              style={{
                height: '52px',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Hapus Digit"
            >
              <Delete size={22} />
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || pin.length === 0}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              background: isLoading || pin.length === 0 ? '#475569' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '16px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: isLoading || pin.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow:
                isLoading || pin.length === 0 ? 'none' : '0 10px 15px -3px rgba(37, 99, 235, 0.4)',
              transition: 'background-color 0.2s',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Memverifikasi PIN...</span>
              </>
            ) : (
              <>
                <Lock size={18} />
                <span>Masuk ke Dashboard Kasir</span>
              </>
            )}
          </button>
        </form>

        {/* Back Link */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              color: '#94a3b8',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Halaman Pelanggan</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            color: '#ffffff',
          }}
        >
          <Loader2 size={32} className="animate-spin" style={{ color: '#3b82f6' }} />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
