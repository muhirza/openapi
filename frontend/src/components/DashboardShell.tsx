'use client';

import { ReactNode } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { useSession } from '../hooks/useSession';

interface DashboardShellProps {
  children: ReactNode;
}

/** Wrapper that guards a dashboard page (requires a server-validated session). */
export function DashboardShell({ children }: DashboardShellProps) {
  const { status, username, logout } = useSession();

  if (status !== 'authenticated' || !username) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-ink-3">Memuat...</div>
      </div>
    );
  }

  return (
    <DashboardLayout username={username} onLogout={logout}>
      {children}
    </DashboardLayout>
  );
}
