'use client';

import { DashboardShell } from '../../components/DashboardShell';
import { BalanceCards } from '../../components/BalanceCards';
import { TopTransactions } from '../../components/TopTransactions';
import { TokenCard } from '../../components/TokenCard';

export default function HomePage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-3">
            Overview of your balances, recent transactions, and token status.
          </p>
        </div>

        {/* Balances + token row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BalanceCards />
          <TokenCard />
        </div>

        {/* Latest transactions */}
        <TopTransactions />
      </div>
    </DashboardShell>
  );
}