'use client';

import { DashboardShell } from '../../../components/DashboardShell';
import { CredentialForm } from '../../../components/CredentialForm';
import { IconShieldCheck } from '../../../components/icons';

export default function ConfigPage() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-4">System</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">API Configuration</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-3">
              Manage the provider credentials that power transactions, balances, and stock sync.
              Each service uses its own API ID and secret.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 sm:self-auto">
            <IconShieldCheck size={14} aria-hidden="true" className="text-success" />
            Encrypted at rest
          </span>
        </header>
        <CredentialForm />
      </div>
    </DashboardShell>
  );
}
