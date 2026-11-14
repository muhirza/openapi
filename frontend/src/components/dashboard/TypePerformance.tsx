'use client';

import { useState } from 'react';
import { DashboardCard } from './DashboardCard';
import {
  TRANSACTION_TYPE_LABELS,
  brandColor,
} from '../../lib/dashboard';
import { formatIDR, toNumber } from '../../lib/format';
import type { TransactionTypePerformance } from '../../types';

interface TypePerformanceProps {
  types: TransactionTypePerformance[] | null;
  loading: boolean;
}

type Metric = 'count' | 'amount';

export function TypePerformance({ types, loading }: TypePerformanceProps) {
  const [metric, setMetric] = useState<Metric>('count');

  if (loading && !types) {
    return (
      <DashboardCard className="p-5">
        <div className="h-3 w-40 animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-3 w-56 animate-pulse rounded bg-surface-muted" />
        <div className="mt-4 space-y-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded bg-surface-muted"
            />
          ))}
        </div>
      </DashboardCard>
    );
  }

  const hasActivity =
    types?.some((type) => type.transaction_count > 0) ?? false;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">
          Transaction performance
        </h2>
        <p className="mt-1 text-xs text-ink-3">
          Count, value, and brand mix per type
        </p>
      </div>

      <div
        className="inline-flex gap-0.5 rounded-control border border-line p-0.5"
        role="group"
        aria-label="Brand mix metric"
      >
        {(['count', 'amount'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={metric === option}
            onClick={() => setMetric(option)}
            className={`rounded px-2 py-1 text-2xs font-semibold transition-colors ${
              metric === option
                ? 'bg-primary-subtle text-primary-hover'
                : 'text-ink-3 hover:bg-surface-muted hover:text-ink-2'
            }`}
          >
            {option === 'count' ? 'Count' : 'Amount'}
          </button>
        ))}
      </div>
    </div>
  );

  if (!types || !hasActivity) {
    return (
      <DashboardCard className="p-5">
        {header}
        <div className="mt-4 rounded-control border border-dashed border-line px-4 py-8 text-center text-sm text-ink-4">
          {types
            ? 'No transaction activity in this range yet.'
            : 'No transaction data available.'}
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard className="p-5">
      {header}

      <div className="mt-3">
        {types.map((type) => {
          const total =
            metric === 'count'
              ? type.transaction_count
              : toNumber(type.transaction_amount);

          const visibleBrands =
            metric === 'count'
              ? type.brands
              : type.brands.filter(
                  (brand) => toNumber(brand.transaction_amount) > 0
                );

          return (
            <div
              key={type.transaction_type}
              className="border-b border-line py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-ink">
                  {TRANSACTION_TYPE_LABELS[type.transaction_type] ??
                    type.transaction_type}
                </span>
                <span className="text-right text-xs tabular-nums text-ink-3">
                  {type.transaction_count} tx ·{' '}
                  {formatIDR(type.transaction_amount)}
                </span>
              </div>

              <div
                className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-muted"
                aria-hidden="true"
              >
                {visibleBrands.map((brand) => {
                  const value =
                    metric === 'count'
                      ? brand.transaction_count
                      : toNumber(brand.transaction_amount);
                  const width = total > 0 ? (value / total) * 100 : 0;

                  return (
                    <span
                      key={brand.brand}
                      style={{
                        width: `${width}%`,
                        backgroundColor: brandColor(brand.brand),
                      }}
                    />
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                {visibleBrands.length === 0 ? (
                  <span>No recorded amount</span>
                ) : (
                  visibleBrands.map((brand) => (
                    <span
                      key={brand.brand}
                      className="inline-flex items-center gap-1.5"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-sm"
                        style={{ backgroundColor: brandColor(brand.brand) }}
                        aria-hidden="true"
                      />
                      {brand.brand}{' '}
                      {metric === 'count'
                        ? `${brand.transaction_count} tx`
                        : formatIDR(brand.transaction_amount)}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
