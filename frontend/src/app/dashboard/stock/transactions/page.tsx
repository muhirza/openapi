'use client';

import { DashboardShell } from '../../../../components/DashboardShell';
import Link from 'next/link';

export default function StockTransactionsPage() {
  return (
    <DashboardShell>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Transaction Info</h1>
          <p className="mt-1 text-sm text-ink-3">
            Look up AWG / XWG stock transaction status and detail.
          </p>
        </div>

        <div className="rounded-surface border border-warning-border bg-warning-subtle p-6">
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="mt-0.5 h-5 w-5 shrink-0 text-warning"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <h2 className="text-sm font-semibold text-warning-strong">
                Waiting on the provider spec for Get Info Transaction
              </h2>
              <p className="mt-1 text-sm text-warning-strong">
                This screen will be built once the AWG / XWG Get Info Transaction and Get Info
                Transaction Detail samples are available. It will also act as the verification
                source for injected stock, reusing the existing status-classification and re-check
                logic.
              </p>
              <Link
                href="/dashboard/stock"
                className="mt-3 inline-block text-sm font-medium text-primary-hover underline hover:text-primary-hover"
              >
                ← Back to Get Stock
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
