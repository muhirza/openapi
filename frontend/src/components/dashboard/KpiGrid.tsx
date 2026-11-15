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
          ? `Tidak ada perubahan dibanding ${compareLabel}`
          : `${positive ? 'Naik' : 'Turun'} ${formatNumber(
              Math.abs(value),
              digits
            )} per hari dibanding ${compareLabel}`
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
        ? 'Tidak berubah'
        : `${positive ? '+' : '−'}${formatNumber(Math.abs(value), digits)}`}
      <span className="font-medium opacity-80">/hari vs {compareLabel}</span>
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
          title="Gagal memuat analitik"
          description={error || 'Layanan analitik tidak mengembalikan respons.'}
          action={
            onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1 rounded-control bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Coba lagi
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
          <span>Gagal memuat ulang analitik. {error}</span>
        </div>
      )}

      {kpis.total === 0 && (
        <div className="rounded-surface border border-dashed border-line-strong bg-surface px-4 py-3 text-sm text-ink-3">
          Belum ada transaksi non-digital pada rentang ini. Coba rentang yang lebih luas.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <DashboardCard className="p-5 md:col-span-2 xl:col-span-2">
          <p className="text-sm font-medium text-ink-3">
            MDA · Rata-rata harian bulanan
          </p>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-2xl font-bold tabular-nums text-ink">
                {formatNumber(current.transactions_per_day, 1)}
                <span className="ml-1 text-sm font-medium text-ink-3">
                  trx/hari
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
                  /hari
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
                Belum ada transaksi non-digital pada{' '}
                {formatMonthShort(current.month)}.
              </>
            ) : (
              <>
                <span className="text-ink-3">
                  {formatNumber(current.transaction_count, 0)} transaksi ·{' '}
                  {formatIDR(current.transaction_amount)}
                </span>{' '}
                dalam {current.elapsed_days} hari berjalan pada{' '}
                {formatMonthShort(current.month)}
              </>
            )}
          </p>
        </DashboardCard>

        <DashboardCard className="p-5">
          <p className="text-sm font-medium text-ink-3">Tingkat keberhasilan</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
            {formatRate(kpis.success_rate)}
          </p>
          <div
            className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-muted"
            role="img"
            aria-label={
              terminal === 0
                ? 'Tidak ada transaksi selesai'
                : `${kpis.success} berhasil dan ${kpis.failed} gagal`
            }
          >
            <span className="bg-success" style={{ width: `${successPct}%` }} />
            <span className="bg-danger" style={{ width: `${errorPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-4">
            {terminal === 0 ? (
              'Belum ada transaksi selesai.'
            ) : (
              <>
                <strong className="font-medium text-ink-3">
                  {kpis.success} dari {terminal}
                </strong>{' '}
                transaksi berhasil
              </>
            )}
          </p>
        </DashboardCard>

        <DashboardCard className="p-5">
          <p className="text-sm font-medium text-ink-3">Tingkat kesalahan</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
            {formatRate(kpis.error_rate)}
          </p>
          <div
            className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-muted"
            role="img"
            aria-label={
              terminal === 0
                ? 'Tidak ada transaksi selesai'
                : `${kpis.failed} gagal dari ${terminal} yang selesai`
            }
          >
            <span className="bg-danger" style={{ width: `${errorPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-4">
            <strong className="font-medium text-ink-3">
              {kpis.failed} gagal
            </strong>{' '}
            · {kpis.processing} diproses
          </p>
        </DashboardCard>

        <DashboardCard className="p-5">
          <p className="text-sm font-medium text-ink-3">Nominal transaksi</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
            {formatIDR(kpis.transaction_amount)}
          </p>
          <p className="mt-2 text-xs text-ink-4">
            <strong className="font-medium text-ink-3">
              {kpis.successful_with_amount} berhasil
            </strong>
            {kpis.average_successful_amount
              ? ` · rata-rata ${formatIDR(kpis.average_successful_amount)}`
              : ''}
          </p>
        </DashboardCard>

        <DashboardCard className="p-5">
          <p className="text-sm font-medium text-ink-3">Transaksi</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-ink">
            {formatNumber(kpis.total, 0)}
          </p>
          <p className="mt-2 text-xs text-ink-4">
            <strong className="font-medium text-ink-3">
              {formatNumber(kpis.transactions_per_day, 1)}/hari
            </strong>{' '}
            dalam {range.elapsed_days} hari
          </p>
        </DashboardCard>
      </div>
    </div>
  );
}
