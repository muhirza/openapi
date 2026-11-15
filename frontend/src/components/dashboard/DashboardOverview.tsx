'use client';

import { useMemo, useState } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { AccountStrip } from './AccountStrip';
import { KpiGrid } from './KpiGrid';
import { DailyVolumeChart } from './DailyVolumeChart';
import { MdaByMonthChart } from './MdaByMonthChart';
import { PerformancePanels } from './PerformancePanels';
import { TopProducts } from './TopProducts';
import { TopTransactions } from '../TopTransactions';
import { useDashboardAnalytics } from '../../hooks/useDashboardAnalytics';
import type { AnalyticsRange } from '../../types';

export function DashboardOverview() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const { data, loading, error, refresh } = useDashboardAnalytics(range);

  const brandNames = useMemo(
    () => data?.brands?.map((brand) => brand.brand) ?? [],
    [data?.brands]
  );

  return (
    <div className="space-y-6">
      <DashboardHeader
        range={range}
        onRangeChange={setRange}
        onRefresh={refresh}
        refreshing={loading}
      />

      <AccountStrip />

      <section>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-base font-semibold text-ink">Stok non-digital</h2>
          <span className="inline-flex items-center rounded-full border border-line bg-surface px-2 py-0.5 text-2xs font-semibold text-ink-3">
            MVP1
          </span>
          <p className="text-sm text-ink-3">
            Beli pulsa, paket data, dan injeksi — semuanya kecuali stok
            digital.
          </p>
        </div>

        <div className="mt-3">
          <KpiGrid
            data={data}
            loading={loading}
            error={error}
            onRetry={refresh}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DailyVolumeChart
            points={data?.daily ?? null}
            range={data?.range ?? null}
            loading={loading}
          />
        </div>
        <MdaByMonthChart mda={data?.mda ?? null} loading={loading} />
      </div>

      <PerformancePanels
        brands={data?.brands ?? null}
        types={data?.transaction_types ?? null}
        loading={loading}
      />

      <TopProducts range={range} brands={brandNames} />

      <TopTransactions />
    </div>
  );
}
