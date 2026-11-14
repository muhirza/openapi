'use client';

import { DashboardCard } from './DashboardCard';
import { DashboardEmptyState } from './DashboardEmptyState';
import {
  formatIDR,
  formatMonthShort,
  formatNumber,
  formatRate,
  toNumber,
} from '../../lib/format';
import { IconAlertCircle } from '../icons';
import type { NonDigitalAnalyticsResponse } from '../../types';

interface KpiGridProps {
  data: NonDigitalAnalyticsResponse | null;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
}

interface DeltaChipProps {
  value: number;
  digits: number;
  compareLabel: string;
}

function DeltaChip({ value, digits, compareLabel }: DeltaChipProps) {
  const flat = Math.abs(value) < 0.005;
  const positive = value > 0;
  const tone = flat
    ? 'bg-line text-ink-2'
    : positive
    ? 'bg-success-subtle text-success-strong'
    : 'bg-danger-subtle text-danger-strong';

  return (
    <span
      className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}
      aria-label={
        flat
          ? `No change versus ${compareLabel}`
          : `${positive ? 'Up' : 'Down'} ${formatNumber(
              Math.abs(value),
              digits
            )} per day versus ${compareLabel}`
      }
    >
      {!flat && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {positive ? (
            <path d="M12 19V5M5 12l7-7 7 7" />
          ) : (
            <path d="M12 5v14M5 12l7 7 7-7" />
          )}
        </svg>
      )}
      {flat
        ? 'No change'
        : `${positive ? '+' : '−'}${formatNumber(Math.abs(value), digits)}`}
      <span className="font-medium opacity-80">/day vs {compareLabel}</span>
    </span>
  );
}

export function KpiGrid({ data, loading, error, onRetry }: KpiGridProps) {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[0, 1, 2, 3, 4].map((index) => (
          <DashboardCard
            key={index}
            className={`p-5 ${index === 0 ? 'md:col-span-2 xl:col-span-2' : ''}`}
          >
            <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
            <div className="mt-4 h-8 w-32 animate-pulse rounded bg-surface-muted" />
            <div className="mt-3 h-3 w-20 animate-pulse rounded bg-surface-muted" />
          </DashboardCard>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <DashboardCard>
        <DashboardEmptyState
          title="Unable to load analytics"
          description={error || 'The analytics service did not return a response.'}
          action={
            onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1 rounded-control bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Try again
              </button>
            ) : undefined
          }
        />
      </DashboardCard>
    );
  }

  const { kpis, mda, range } = data;
  const current = mda.current;
  const previous = mda.previous;
  const comparison = previous ? formatMonthShort(previous.month) : null;
  const trxDelta = previous
    ? toNumber(current.transactions_per_day) -
      toNumber(previous.transactions_per_day)
    : null;
  const amountDelta = previous
    ? toNumber(current.amount_per_day) - toNumber(previous.amount_per_day)
    : null;
  const terminal = kpis.success + kpis.failed;
  const successPct = toNumber(kpis.success_rate) * 100;
  const errorPct = toNumber(kpis.error_rate) * 100;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-control border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
          <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>Could not refresh analytics. {error}</span>
        </div>
      )}

      {kpis.total === 0 && (
        <div className="rounded-surface border border-dashed border-line-strong bg-surface px-4 py-3 text-sm text-ink-3">
          No non-digital transactions in this range yet. Try a wider range.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <DashboardCard className="p-5 md:col-span-2 xl:col-span-2">
          <p className="text-sm font-medium text-ink-3">
            MDA · Monthly daily average
          </p>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-2xl font-bold tabular-nums text-ink">
                {formatNumber(current.transactions_per_day, 1)}
                <span className="ml-1 text-sm font-medium text-ink-3">
                  trx/day
                </span>
              </p>
              {trxDelta !== null && comparison && (
                <DeltaChip
                  value={trxDelta}
                  digits={1}
                  compareLabel={comparison}
                />
              )}
            </div>

            <div className="sm:border-l sm:border-line sm:pl-4">
              <p className="text-2xl font-bold tabular-nums text-ink">
                {formatIDR(current.amount_per_day)}
                <span className="ml-1 text-sm font-medium text-ink-3">
                  /day
                </span>
              </p>
              {amountDelta !== null && comparison && (
                <DeltaChip
                  value={amountDelta}
                  digits={0}
                  compareLabel={comparison}
                />
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-ink-4">
            {current.transaction_count === 0 ? (
              <>
                No non-digital transactions in{' '}
                {formatMonthShort(current.month)} yet.
              </>
            ) : (
              <>
                <span className="text-ink-3">
                  {formatNumber(current.transaction_count, 0)} transactions ·{' '}
                  {formatIDR(current.transaction_amount)}
                </span>{' '}
                across {current.elapsed_days} elapsed days in{' '}
                {formatMonthShort(current.month)}
              </>
            )}
          </p>
        </DashboardCard>

        <DashboardCard className="p-5">
          <p className="text-sm font-medium text-ink-3">Success rate</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
            {formatRate(kpis.success_rate)}
          </p>
          <div
            className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-muted"
            role="img"
            aria-label={
              terminal === 0
                ? 'No completed transactions'
                : `${kpis.success} successful and ${kpis.failed} failed`
            }
          >
            <span className="bg-success" style={{ width: `${successPct}%` }} />
            <span className="bg-danger" style={{ width: `${errorPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-4">
            {terminal === 0 ? (
              'No completed transactions yet.'
            ) : (
              <>
                <strong className="font-medium text-ink-3">
                  {kpis.success} of {terminal}
                </strong>{' '}
                transactions succeeded
              </>
            )}
          </p>
        </DashboardCard>

        <DashboardCard className="p-5">
          <p className="text-sm font-medium text-ink-3">Error rate</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
            {formatRate(kpis.error_rate)}
          </p>
          <div
            className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-muted"
            role="img"
            aria-label={
              terminal === 0
                ? 'No completed transactions'
                : `${kpis.failed} failed out of ${terminal} completed`
            }
          >
            <span className="bg-danger" style={{ width: `${errorPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-4">
            <strong className="font-medium text-ink-3">
              {kpis.failed} failed
            </strong>{' '}
            · {kpis.processing} processing
          </p>
        </DashboardCard>

        <DashboardCard className="p-5">
          <p className="text-sm font-medium text-ink-3">Transaction amount</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
            {formatIDR(kpis.transaction_amount)}
          </p>
          <p className="mt-2 text-xs text-ink-4">
            <strong className="font-medium text-ink-3">
              {kpis.successful_with_amount} successful
            </strong>
            {kpis.average_successful_amount
              ? ` · avg ${formatIDR(kpis.average_successful_amount)}`
              : ''}
          </p>
        </DashboardCard>

        <DashboardCard className="p-5">
          <p className="text-sm font-medium text-ink-3">Transactions</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
            {formatNumber(kpis.total, 0)}
          </p>
          <p className="mt-2 text-xs text-ink-4">
            <strong className="font-medium text-ink-3">
              {formatNumber(kpis.transactions_per_day, 1)}/day
            </strong>{' '}
            over {range.elapsed_days} days
          </p>
        </DashboardCard>
      </div>
    </div>
  );
}
