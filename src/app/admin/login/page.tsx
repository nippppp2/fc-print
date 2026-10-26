'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, ShieldCheck, Delete, ArrowLeft, Loader2 } from 'lucide-react';

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
      if (pin.length < 10) {
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
        throw new Error(data.error || 'PIN salah!');
      }

      // Login berhasil -> Arahkan ke dashboard admin
      router.push(redirectPath);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk';
      setError(msg);
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Portal Kasir</h1>
          <p className="text-slate-400 text-xs mt-1">
            Masukkan PIN toko untuk mengakses antrean & dokumen
          </p>
        </div>

        {/* Form PIN */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={10}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                placeholder="••••"
                autoFocus
                className="w-full text-center tracking-[0.4em] text-2xl font-bold bg-slate-950/70 border border-slate-700 focus:border-blue-500 text-white rounded-2xl py-3.5 px-10 outline-none transition-all placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 transition-colors"
                title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <div className="mt-2.5 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center font-medium animate-pulse">
                {error}
              </div>
            )}
          </div>

          {/* Virtual Touch Keypad */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num.toString())}
                className="h-12 bg-slate-700/60 hover:bg-slate-700 active:bg-blue-600 text-white font-semibold text-lg rounded-xl transition-colors border border-slate-600/40"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress('CLEAR')}
              className="h-12 bg-slate-800 hover:bg-slate-700/80 active:bg-slate-600 text-amber-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors border border-slate-700"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="h-12 bg-slate-700/60 hover:bg-slate-700 active:bg-blue-600 text-white font-semibold text-lg rounded-xl transition-colors border border-slate-600/40"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('BACK')}
              className="h-12 bg-slate-800 hover:bg-slate-700/80 active:bg-slate-600 text-slate-300 flex items-center justify-center rounded-xl transition-colors border border-slate-700"
              title="Hapus Digit"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading || pin.length === 0}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all text-sm mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Masuk ke Dashboard Kasir
              </>
            )}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Halaman Kirim Dokumen
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
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
