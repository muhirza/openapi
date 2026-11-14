'use client';

import { DashboardCard } from './DashboardCard';
import { brandColor } from '../../lib/dashboard';
import { formatIDR, toNumber } from '../../lib/format';
import type { BrandPerformance as BrandPerformanceItem } from '../../types';

interface BrandPerformanceProps {
  brands: BrandPerformanceItem[] | null;
  loading: boolean;
}

interface ShareBarProps {
  label: string;
  percent: number;
  color: string;
  opacity?: number;
}

function ShareBar({ label, percent, color, opacity = 1 }: ShareBarProps) {
  const width = Math.min(100, Math.max(0, percent));

  return (
    <div className="mt-2 grid grid-cols-[74px_minmax(0,1fr)_36px] items-center gap-2 text-xs">
      <span className="text-ink-3">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <span
          className="block h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color, opacity }}
        />
      </span>
      <span className="text-right tabular-nums text-ink-3">{percent}%</span>
    </div>
  );
}

export function BrandPerformance({ brands, loading }: BrandPerformanceProps) {
  if (loading && !brands) {
    return (
      <DashboardCard className="p-5">
        <div className="h-3 w-32 animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-surface-muted" />
        <div className="mt-4 space-y-4">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded bg-surface-muted"
            />
          ))}
        </div>
      </DashboardCard>
    );
  }

  const empty = !brands || brands.length === 0;

  return (
    <DashboardCard className="p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Brand performance</h2>
        <p className="mt-1 text-xs text-ink-3">
          Share of total transactions vs share of total value
        </p>
      </div>

      {empty ? (
        <div className="mt-4 rounded-control border border-dashed border-line px-4 py-8 text-center text-sm text-ink-4">
          {brands
            ? 'No brand activity in this range yet.'
            : 'No brand data available.'}
        </div>
      ) : (
        <div className="mt-3">
          {brands.map((brand) => {
            const color = brandColor(brand.brand);
            const countPercent = Math.round(toNumber(brand.count_share) * 100);
            const amountPercent = Math.round(
              toNumber(brand.amount_share) * 100
            );

            return (
              <div
                key={brand.brand}
                className="border-b border-line py-3 first:pt-0 last:border-0 last:pb-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">
                    {brand.brand}
                  </span>
                  <span className="text-right text-xs tabular-nums text-ink-3">
                    {brand.transaction_count} tx ·{' '}
                    {formatIDR(brand.transaction_amount)}
                  </span>
                </div>

                <ShareBar
                  label="Transactions"
                  percent={countPercent}
                  color={color}
                />
                <ShareBar
                  label="Value"
                  percent={amountPercent}
                  color={color}
                  opacity={0.4}
                />
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
