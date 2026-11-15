'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '../../components/LoginForm';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('expired');
    if (reason) {
      setNotice('Sesi Anda berakhir karena tidak ada aktivitas. Silakan masuk kembali.');
    }
  }, []);

  const handleLogin = async (username: string, password: string) => {
    await api.login(username, password);
    router.replace('/dashboard');
  };

  const handleRegister = async (username: string, password: string) => {
    await api.register(username, password);
    await api.login(username, password);
    router.replace('/dashboard');
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Sky background */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-100 to-white" />
      <div aria-hidden="true" className="absolute -left-[10%] top-[42%] h-72 w-[55%] rounded-full bg-surface/70 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-[15%] top-[58%] h-80 w-[55%] rounded-full bg-surface/60 blur-3xl" />
      <div aria-hidden="true" className="absolute bottom-[-8%] left-[8%] h-72 w-[75%] rounded-full bg-surface/80 blur-3xl" />
      <div aria-hidden="true" className="absolute left-1/2 top-[52%] h-[520px] w-[520px] -translate-x-1/2 rounded-full border border-white/40" />
      <div aria-hidden="true" className="absolute left-1/2 top-[64%] h-[760px] w-[760px] -translate-x-1/2 rounded-full border border-white/30" />

      {/* Brand */}
      <header className="relative z-10 flex items-center gap-2.5 px-6 pt-6 sm:px-10 sm:pt-8">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </span>
        <span className="text-lg font-bold tracking-tight text-ink">OPEN API SIDIVA Dashboard</span>
      </header>

      {/* Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] rounded-3xl border border-white/60 bg-surface/70 p-8 shadow-xl backdrop-blur-xl sm:p-10">
          <div className="flex justify-center">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-ink shadow-md ring-1 ring-line"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </span>
          </div>

          <h1 className="mt-5 text-center text-2xl font-bold text-ink">
            {showRegister ? 'Buat akun Anda' : 'Masuk dengan nama pengguna'}
          </h1>
          <p className="mx-auto mt-2 max-w-[30ch] text-center text-sm leading-relaxed text-ink-3">
            {showRegister
              ? 'Daftar untuk melakukan transaksi, memantau saldo, dan melihat riwayat.'
              : 'Akses transaksi, saldo, dan riwayat dalam satu konsol yang aman.'}
          </p>

          {notice && (
            <div
              role="status"
              className="mt-6 rounded-xl border border-warning-border bg-warning-subtle px-4 py-3 text-sm text-warning-strong"
            >
              {notice}
            </div>
          )}

          <div className="mt-7">
            <LoginForm
              mode={showRegister ? 'register' : 'login'}
              onLogin={showRegister ? handleRegister : handleLogin}
            />
          </div>

          <div className="mt-7 flex items-center gap-3">
            <div aria-hidden="true" className="h-px flex-1 border-t border-dashed border-line-strong" />
            <span className="text-xs text-ink-4">Atau</span>
            <div aria-hidden="true" className="h-px flex-1 border-t border-dashed border-line-strong" />
          </div>

          <button
            type="button"
            onClick={() => setShowRegister(!showRegister)}
            className="mt-4 w-full cursor-pointer rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm font-medium text-ink-2 transition-colors duration-200 hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {showRegister ? 'Kembali ke Halaman Masuk' : 'Pengguna baru? Daftar'}
          </button>
        </div>
      </main>
    </div>
  );
}
