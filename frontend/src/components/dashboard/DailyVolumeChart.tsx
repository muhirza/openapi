'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardCard } from './DashboardCard';
import { ChartDataTable } from './ChartDataTable';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import {
  formatCompactIDR,
  formatDayMonth,
  formatIDR,
  toNumber,
} from '../../lib/format';
import type { AnalyticsWindow, DailyPoint } from '../../types';

interface DailyVolumeChartProps {
  points: DailyPoint[] | null;
  range: AnalyticsWindow | null;
  loading: boolean;
}

interface DailyChartPoint extends DailyPoint {
  amount: number;
}

interface DailyTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyChartPoint }>;
}

function DailyTooltip({ active, payload }: DailyTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-xs">
      <p className="font-semibold text-ink">{formatDayMonth(point.date)}</p>
      <p className="mt-1 text-ink-2">
        {point.success} berhasil · {point.failed} gagal
        {point.processing > 0 ? ` · ${point.processing} diproses` : ''}
      </p>
      <p className="text-ink-2">
        Nominal: {formatIDR(point.transaction_amount)}
      </p>
    </div>
  );
}

export function DailyVolumeChart({
  points,
  range,
  loading,
}: DailyVolumeChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading && !points) {
    return (
      <DashboardCard className="p-5">
        <div className="h-3 w-28 animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-surface-muted" />
        <div className="mt-4 h-[210px] animate-pulse rounded-control bg-surface-muted" />
      </DashboardCard>
    );
  }

  if (!points || points.length === 0) {
    return (
      <DashboardCard className="p-5">
        <h2 className="text-sm font-semibold text-ink">Volume harian</h2>
        <p className="mt-1 text-xs text-ink-3">
          Jumlah transaksi dengan nominal berhasil
        </p>
        <div className="mt-4 flex h-[210px] items-center justify-center rounded-control border border-dashed border-line text-sm text-ink-4">
          Data grafik tidak tersedia.
        </div>
      </DashboardCard>
    );
  }

  const chartData: DailyChartPoint[] = points.map((point) => ({
    ...point,
    amount: toNumber(point.transaction_amount),
  }));

  const totals = points.reduce(
    (accumulator, point) => ({
      total: accumulator.total + point.total,
      success: accumulator.success + point.success,
      failed: accumulator.failed + point.failed,
      processing: accumulator.processing + point.processing,
      amount: accumulator.amount + toNumber(point.transaction_amount),
    }),
    { total: 0, success: 0, failed: 0, processing: 0, amount: 0 }
  );

  const hasActivity = totals.total > 0 || totals.amount > 0;
  const firstDate = points[0].date;
  const lastDate = points[points.length - 1].date;
  const step = points.length > 45 ? 20 : points.length > 14 ? 5 : 1;
  const candidates = points
    .map((point, index) => ({ point, index }))
    .filter(
      ({ point, index }) =>
        index === 0 ||
        index === points.length - 1 ||
        point.date.slice(8, 10) === '01' ||
        index % step === 0
    );
  const monthStartIndexes = new Set(
    candidates
      .filter(({ point }) => point.date.slice(8, 10) === '01')
      .map(({ index }) => index)
  );
  const ticks = candidates
    .filter(
      ({ index }) =>
        index === 0 ||
        index === points.length - 1 ||
        (!monthStartIndexes.has(index - 1) &&
          !monthStartIndexes.has(index - 2))
    )
    .map(({ point }) => point.date);

  const subtitle =
    range?.key === 'month'
      ? 'Bulan ini hingga sekarang'
      : range
      ? `${range.elapsed_days} hari terakhir`
      : 'Rentang terpilih';

  return (
    <DashboardCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Volume harian</h2>
          <p className="mt-1 text-xs text-ink-3">
            Jumlah transaksi dengan nominal berhasil · {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-success" aria-hidden="true" />
            Berhasil
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-danger" aria-hidden="true" />
            Gagal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3.5 rounded bg-primary"
              aria-hidden="true"
            />
            Nominal
          </span>
        </div>
      </div>

      {hasActivity ? (
        <div
          className="mt-4"
          role="img"
          aria-label={`Jumlah transaksi harian dan nominal berhasil, total ${totals.total} transaksi dan ${formatIDR(
            totals.amount
          )}`}
        >
          {mounted ? (
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  ticks={ticks}
                  interval={0}
                  tickFormatter={(value: string) => {
                    const isEdge =
                      value === firstDate ||
                      value === lastDate ||
                      value.slice(8, 10) === '01';
                    return isEdge
                      ? formatDayMonth(value)
                      : String(Number(value.slice(8, 10)));
                  }}
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  yAxisId="count"
                  allowDecimals={false}
                  width={28}
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: 'trx',
                    position: 'insideTopLeft',
                    fill: '#94A3B8',
                    fontSize: 10,
                  }}
                />
                <YAxis
                  yAxisId="amount"
                  orientation="right"
                  width={44}
                  tickFormatter={formatCompactIDR}
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: 'Rp',
                    position: 'insideTopRight',
                    fill: '#94A3B8',
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  content={<DailyTooltip />}
                />
                <Bar
                  yAxisId="count"
                  dataKey="success"
                  stackId="trx"
                  name="Berhasil"
                  fill="#16A34A"
                  radius={2}
                  isAnimationActive={!reducedMotion}
                  animationDuration={450}
                />
                <Bar
                  yAxisId="count"
                  dataKey="failed"
                  stackId="trx"
                  name="Gagal"
                  fill="#DC2626"
                  radius={2}
                  isAnimationActive={!reducedMotion}
                  animationDuration={450}
                />
                <Line
                  yAxisId="amount"
                  type="monotone"
                  dataKey="amount"
                  name="Nominal"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={!reducedMotion}
                  animationDuration={450}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[210px]" />
          )}
        </div>
      ) : (
        <div className="mt-4 flex h-[210px] items-center justify-center rounded-control border border-dashed border-line text-sm text-ink-4">
          Belum ada transaksi pada rentang ini.
        </div>
      )}

      <p className="mt-2 text-xs text-ink-4">
        Batang: berhasil dan gagal (kiri). Garis: nominal berhasil (kanan).{' '}
        {totals.total} transaksi · {formatIDR(totals.amount)}
      </p>

      <ChartDataTable
        columns={['Tanggal', 'Total', 'Berhasil', 'Gagal', 'Diproses', 'Nominal']}
        rows={points.map((point) => [
          formatDayMonth(point.date),
          point.total,
          point.success,
          point.failed,
          point.processing,
          formatIDR(point.transaction_amount),
        ])}
        footer={[
          'Total',
          totals.total,
          totals.success,
          totals.failed,
          totals.processing,
          formatIDR(totals.amount),
        ]}
      />
    </DashboardCard>
  );
}
