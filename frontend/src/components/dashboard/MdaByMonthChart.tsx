'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  formatIDR,
  formatMonthShort,
  formatNumber,
  toNumber,
} from '../../lib/format';
import type { MonthlyMdaPoint, NonDigitalMda } from '../../types';

interface MdaByMonthChartProps {
  mda: NonDigitalMda | null;
  loading: boolean;
}

type MdaMetric = 'trx' | 'amount';

interface MdaChartPoint extends MonthlyMdaPoint {
  label: string;
  trx: number;
  amount: number;
}

interface MdaTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MdaChartPoint }>;
}

function MdaTooltip({ active, payload }: MdaTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-xs">
      <p className="font-semibold text-ink">{formatMonthShort(point.month)}</p>
      <p className="mt-1 text-ink-2">
        {formatNumber(point.transactions_per_day, 1)} trx/day ·{' '}
        {formatIDR(point.amount_per_day)}/day
      </p>
      <p className="text-ink-2">
        {point.transaction_count} transactions ·{' '}
        {formatIDR(point.transaction_amount)}
      </p>
    </div>
  );
}

interface MonthTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string };
}

export function MdaByMonthChart({ mda, loading }: MdaByMonthChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [metric, setMetric] = useState<MdaMetric>('trx');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading && !mda) {
    return (
      <DashboardCard className="p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-surface-muted" />
        <div className="mt-4 h-[180px] animate-pulse rounded-control bg-surface-muted" />
      </DashboardCard>
    );
  }

  if (!mda) {
    return (
      <DashboardCard className="p-5">
        <h2 className="text-sm font-semibold text-ink">MDA by month</h2>
        <p className="mt-1 text-xs text-ink-3">Average per day</p>
        <div className="mt-4 flex h-[180px] items-center justify-center rounded-control border border-dashed border-line text-sm text-ink-4">
          No chart data available.
        </div>
      </DashboardCard>
    );
  }

  const chartData: MdaChartPoint[] = mda.months.map((point) => ({
    ...point,
    label: formatMonthShort(point.month),
    trx: toNumber(point.transactions_per_day),
    amount: toNumber(point.amount_per_day),
  }));

  const dataKey = metric === 'trx' ? 'trx' : 'amount';
  const currentLabel = formatMonthShort(mda.current.month);
  const hasActivity = mda.months.some(
    (point) =>
      point.transaction_count > 0 || toNumber(point.transaction_amount) > 0
  );

  const MonthTick = ({ x, y, payload }: MonthTickProps) => {
    const isCurrent = payload?.value === currentLabel;
    return (
      <text
        x={x}
        y={y}
        dy="0.71em"
        textAnchor="middle"
        fill={isCurrent ? '#334155' : '#94A3B8'}
        fontSize={11}
        fontWeight={isCurrent ? 600 : 400}
      >
        {payload?.value}
      </text>
    );
  };

  return (
    <DashboardCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">MDA by month</h2>
          <p className="mt-1 text-xs text-ink-3">Average per day</p>
        </div>

        <div
          className="inline-flex gap-0.5 rounded-control border border-line p-0.5"
          role="group"
          aria-label="MDA metric"
        >
          {(['trx', 'amount'] as const).map((option) => (
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
              {option === 'trx' ? 'Count/day' : 'Amount/day'}
            </button>
          ))}
        </div>
      </div>

      {hasActivity ? (
        <div
          className="mt-4"
          role="img"
          aria-label={`Monthly daily average from ${formatMonthShort(
            mda.months[0]?.month
          )} to ${currentLabel}`}
        >
          {mounted ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={MonthTick}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={6}
                />
                <YAxis
                  width={40}
                  allowDecimals
                  tickFormatter={
                    metric === 'trx'
                      ? (value: number) => formatNumber(value, 1)
                      : formatCompactIDR
                  }
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: metric === 'trx' ? 'trx/day' : 'Rp/day',
                    position: 'insideTopLeft',
                    fill: '#94A3B8',
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  content={<MdaTooltip />}
                />
                <Bar
                  dataKey={dataKey}
                  name={metric === 'trx' ? 'Count/day' : 'Amount/day'}
                  radius={2}
                  maxBarSize={34}
                  isAnimationActive={!reducedMotion}
                  animationDuration={450}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.month}
                      fill={
                        entry.is_current_month ? '#2563EB' : '#CBD5E1'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px]" />
          )}
        </div>
      ) : (
        <div className="mt-4 flex h-[180px] items-center justify-center rounded-control border border-dashed border-line text-sm text-ink-4">
          No monthly activity yet.
        </div>
      )}

      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-4">
        <span className="h-2 w-2 rounded-sm bg-primary" aria-hidden="true" />
        {currentLabel} covers {mda.current.elapsed_days} elapsed days.
      </p>

      <ChartDataTable
        columns={['Month', 'Transactions', 'Trx/day', 'Amount', 'Amount/day']}
        rows={mda.months.map((point) => [
          `${formatMonthShort(point.month)} ${point.month.slice(0, 4)}`,
          point.transaction_count,
          formatNumber(point.transactions_per_day, 2),
          formatIDR(point.transaction_amount),
          formatIDR(point.amount_per_day),
        ])}
      />
    </DashboardCard>
  );
}
