'use client';

import { useEffect, useState } from 'react';
import { DashboardCard } from './DashboardCard';
import { api } from '../../lib/api';
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_ORDER,
  brandColor,
} from '../../lib/dashboard';
import { formatIDR } from '../../lib/format';
import type { AnalyticsRange, TopProduct } from '../../types';

interface TopProductsProps {
  range: AnalyticsRange;
  brands: string[];
}

const SELECT_CLASS =
  'rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm text-ink-2 focus:outline-none focus:ring-2 focus:ring-primary/40';

export function TopProducts({ range, brands }: TopProductsProps) {
  const [transactionType, setTransactionType] = useState('buy_pulsa');
  const [brand, setBrand] = useState('all');
  const [items, setItems] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (brand !== 'all' && !brands.includes(brand)) {
      setBrand('all');
    }
  }, [brands, brand]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    api
      .getTopProducts({ range, transactionType, brand, limit: 5 })
      .then((response) => {
        if (!cancelled) setItems(response.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load top products'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, transactionType, brand, version]);

  const maxCount =
    items.reduce((max, item) => Math.max(max, item.transaction_count), 0) || 1;
  const typeLabel = TRANSACTION_TYPE_LABELS[transactionType] ?? transactionType;
  const brandLabel = brand === 'all' ? 'All brands' : brand;

  return (
    <DashboardCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Top products</h2>
          <p className="mt-1 text-xs text-ink-3">
            {typeLabel} · {brandLabel}
            {loading && items.length > 0 ? ' · Updating…' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="top-products-type"
            className="text-xs text-ink-3"
          >
            Type
          </label>
          <select
            id="top-products-type"
            value={transactionType}
            onChange={(event) => setTransactionType(event.target.value)}
            className={SELECT_CLASS}
          >
            {TRANSACTION_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {TRANSACTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          <label
            htmlFor="top-products-brand"
            className="text-xs text-ink-3"
          >
            Brand
          </label>
          <select
            id="top-products-brand"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All brands</option>
            {brands.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-control border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger-strong">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setVersion((current) => current + 1)}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded bg-surface-muted"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-control border border-dashed border-line px-4 py-8 text-center text-sm text-ink-4">
          No transactions for this combination yet.
        </div>
      ) : (
        <div className="mt-3" aria-busy={loading}>
          {items.map((item, index) => (
            <div
              key={`${item.product_code ?? 'unknown'}-${item.transaction_type}-${item.brand}-${index}`}
              className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2.5 first:pt-0 last:border-0 last:pb-0"
            >
              <span className="text-xs font-semibold tabular-nums text-ink-4">
                {index + 1}
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {item.display_name}
                </p>
                <p className="text-xs text-ink-3">
                  {TRANSACTION_TYPE_LABELS[item.transaction_type] ??
                    item.transaction_type}{' '}
                  · {item.brand}
                </p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(
                        2,
                        (item.transaction_count / maxCount) * 100
                      )}%`,
                      backgroundColor: brandColor(item.brand),
                    }}
                  />
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-ink">
                  {item.transaction_count} tx
                </p>
                <p className="text-xs tabular-nums text-ink-3">
                  {formatIDR(item.transaction_amount)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
