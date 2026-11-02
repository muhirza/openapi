'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from './DashboardLayout';
import { api } from '../lib/api';

interface DashboardShellProps {
  children: ReactNode;
}

/** Wrapper that guards a dashboard page (requires login) and provides logout. */
export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const name = localStorage.getItem('username');
    if (!name) {
      router.push('/login');
      return;
    }
    setUsername(name);
  }, [router]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('username');
    router.push('/login');
  };

  if (!username) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-ink-3">Loading...</div>
      </div>
    );
  }

  return (
    <DashboardLayout username={username} onLogout={handleLogout}>
      {children}
    </DashboardLayout>
  );
}