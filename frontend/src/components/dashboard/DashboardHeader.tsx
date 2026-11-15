'use client';

import { IconRefresh } from '../icons';
import { ANALYTICS_RANGES } from '../../lib/dashboard';
import type { AnalyticsRange } from '../../types';

interface DashboardHeaderProps {
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function DashboardHeader({
  range,
  onRangeChange,
  onRefresh,
  refreshing = false,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-3">
          Performa stok non-digital, saldo, dan aktivitas terbaru.
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
        <div
          className="inline-flex shrink-0 gap-0.5 rounded-surface border border-line bg-surface p-1"
          role="group"
          aria-label="Rentang tanggal"
        >
          {ANALYTICS_RANGES.map((option) => {
            const active = option.key === range;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => onRangeChange(option.key)}
                className={`rounded-control px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'text-ink-3 hover:bg-surface-muted hover:text-ink-2'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          <IconRefresh size={14} className={refreshing ? 'animate-spin' : ''} />
          Muat ulang
        </button>
      </div>
    </div>
  );
}
