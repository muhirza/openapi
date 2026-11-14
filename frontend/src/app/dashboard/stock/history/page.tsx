'use client';

import { DashboardShell } from '../../../../components/DashboardShell';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import {
  StockFamily,
  StockHistoryListResponse,
  StockServiceType,
} from '../../../../types';
import { StatusBadge } from '../../../../components/StatusBadge';
import { formatIDR, formatDateOnly } from '../../../../lib/format';
import Link from 'next/link';

const SERVICE_TYPES: Record<StockFamily, { value: StockServiceType; label: string }[]> = {
  awg: [
    { value: 'SELLVOUCHER', label: 'Inject SP' },
    { value: 'PHYSICALVOUCHER', label: 'Inject Voucher' },
    { value: 'TRANSFER', label: 'Receive Transfer Stock' },
    { value: 'BUYSTOCK', label: 'Buy Stock (Mini Grosir)' },
    { value: 'EXTENDSTOCK', label: 'Extend Stock WG' },
  ],
  xwg: [
    { value: 'SELLVOUCHER', label: 'Inject SP' },
    { value: 'PHYSICALVOUCHER', label: 'Inject Voucher' },
    { value: 'TRANSFER', label: 'Receive Transfer Stock' },
    { value: 'BUYSTOCK', label: 'Buy Stock (Mini Grosir)' },
    { value: 'EXTENDSTOCK', label: 'Extend Stock WG' },
    { value: 'TRFBALANCE', label: 'Transfer Balance to Parent' },
    { value: 'TEMBAKSTOK', label: 'Inject Stock Parent' },
  ],
};

const STATUS_CHIPS = [
  { key: '', label: 'All', tone: 'gray', count: (s: { total: number }) => s.total },
  { key: 'SUCCESS', label: 'Success', tone: 'green', count: (s: { success: number }) => s.success },
  { key: 'FAILED', label: 'Failed', tone: 'red', count: (s: { failed: number }) => s.failed },
  { key: 'PROCESSING', label: 'Processing', tone: 'amber', count: (s: { processing: number }) => s.processing },
] as const;

const CHIP_ACTIVE: Record<string, string> = {
  gray: 'bg-ink-2 text-white',
  green: 'bg-success-strong text-white',
  red: 'bg-danger text-white',
  amber: 'bg-warning text-white',
};

function serviceLabel(family: StockFamily, servicetype: string): string {
  return SERVICE_TYPES[family].find((t) => t.value === servicetype)?.label ?? servicetype;
}

/** Compact copyable reference: truncates on screen, copies the full value. */
function RefCell({
  label,
  value,
  copiedKey,
  onCopy,
}: {
  label: string;
  value: string | null | undefined;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-8 shrink-0 text-2xs uppercase tracking-wide text-ink-4">{label}</span>
        <span className="text-xs text-ink-4">—</span>
      </div>
    );
  }
  const key = `${label}:${value}`;
  return (
    <div className="flex items-start gap-1.5">
      <span className="w-9 shrink-0 pt-px text-2xs uppercase tracking-wide text-ink-4">{label}</span>
      <button
        type="button"
        onClick={() => onCopy(key, value)}
        title={`${value} — click to copy`}
        className="min-w-0 flex-1 break-all text-left text-2xs leading-snug font-mono text-ink-2 hover:text-primary-hover hover:underline"
      >
        {value}
      </button>
      {copiedKey === key && <span className="shrink-0 text-2xs text-success-strong">copied</span>}
    </div>
  );
}

export default function StockHistoryPage() {
  const [family, setFamily] = useState<StockFamily>('awg');
  const [data, setData] = useState<StockHistoryListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [range, setRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [recheckingId, setRecheckingId] = useState<number | null>(null);

  // Deep link from an injection result: /dashboard/stock/history?family=xwg
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('family');
    if (param === 'awg' || param === 'xwg') setFamily(param);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const startDate = (() => {
    const now = new Date();
    if (range === 'today') return now.toISOString().slice(0, 10);
    if (range === '7d') return new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    if (range === '30d') return new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
    return undefined;
  })();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getStockHistory(family, {
        page,
        perPage,
        servicetype: filterService || undefined,
        status: filterStatus || undefined,
        search: debouncedSearch || undefined,
        startDate,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock history');
    } finally {
      setLoading(false);
    }
  }, [family, page, perPage, filterService, filterStatus, debouncedSearch, startDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [family, filterService, filterStatus, debouncedSearch, range]);

  const handleRecheck = async (id: number) => {
    setRecheckingId(id);
    setError('');
    try {
      await api.refreshStockHistoryDetail(family, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-check status');
    } finally {
      setRecheckingId(null);
    }
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {}
  };

  const hasFilters = Boolean(filterService || filterStatus || debouncedSearch || range !== 'all');
  const summary = data?.summary ?? null;

  return (
    <DashboardShell>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Stock History</h1>
          <p className="mt-1 text-sm text-ink-3">
            Digital stock operations executed in this system (inject SP, inject voucher), kept
            separate from the non-stock transaction history. Status is checked via the
            provider&apos;s Info Transaction Detail API.
          </p>
        </div>

        <div className="bg-surface rounded-surface shadow border p-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="inline-flex rounded-control border border-line-strong p-0.5 text-sm" role="group" aria-label="Stock family">
              {(['xwg', 'awg'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFamily(value);
                    setFilterService('');
                  }}
                  aria-pressed={family === value}
                  className={`rounded-control px-3 py-1.5 font-medium uppercase transition-colors ${
                    family === value ? 'bg-primary text-white' : 'text-ink-2 hover:bg-line'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, voucher code, or masterTrxId..."
              aria-label="Search stock history"
              className="w-72 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
            />
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              aria-label="Filter by service type"
              className="w-52 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
            >
              <option value="">All Operations</option>
              {SERVICE_TYPES[family].map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-control border border-line-strong p-0.5 text-sm" role="group" aria-label="Filter by date range">
              {([
                ['all', 'All time'],
                ['today', 'Today'],
                ['7d', '7 days'],
                ['30d', '30 days'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRange(value)}
                  aria-pressed={range === value}
                  className={`rounded-control px-2.5 py-1.5 transition-colors ${
                    range === value ? 'bg-primary text-white' : 'text-ink-2 hover:bg-line'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button
                onClick={() => {
                  setFilterService('');
                  setFilterStatus('');
                  setSearch('');
                  setRange('all');
                  setPage(1);
                }}
                className="text-sm text-ink-3 hover:text-ink-2 underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {summary && summary.total > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-control border border-line bg-canvas px-3 py-2.5">
              {STATUS_CHIPS.map((chip) => {
                const active = filterStatus === chip.key;
                return (
                  <button
                    key={chip.key || 'all'}
                    type="button"
                    onClick={() => {
                      setFilterStatus(chip.key);
                      setPage(1);
                    }}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? CHIP_ACTIVE[chip.tone]
                        : 'border border-line bg-surface text-ink-2 hover:bg-line'
                    }`}
                  >
                    {chip.label}
                    <span className={`tabular-nums ${active ? 'opacity-90' : 'text-ink-4'}`}>
                      {chip.count(summary)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mb-4 bg-danger-subtle border border-danger-border text-danger-strong px-4 py-3 rounded-control text-sm">
              {error}
            </div>
          )}

          {/* Desktop table */}
          <div className="hidden xl:block">
            <table className="w-full table-fixed divide-y divide-line">
              <colgroup>
                <col className="w-[100px]" />
                <col className="w-[15%]" />
                <col className="w-[19%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[110px]" />
                <col className="w-[17%]" />
                <col className="w-[110px]" />
              </colgroup>
              <thead>
                <tr className="text-left text-2xs font-semibold text-ink-3 uppercase tracking-wider">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Operation</th>
                  <th className="pb-2 pr-3">Product</th>
                  <th className="pb-2 pr-3">Destination</th>
                  <th className="pb-2 pr-3 text-right">Price</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Reference</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && !data ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="animate-pulse">
                      <td className="py-3 pr-3"><div className="h-3 w-16 rounded-control bg-line" /></td>
                      <td className="py-3 pr-3">
                        <div className="h-3 w-24 rounded-control bg-line" />
                        <div className="mt-1.5 h-2.5 w-20 rounded-control bg-line" />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="h-3 w-32 rounded-control bg-line" />
                        <div className="mt-1.5 h-2.5 w-24 rounded-control bg-line" />
                      </td>
                      <td className="py-3 pr-3"><div className="h-3 w-20 rounded-control bg-line" /></td>
                      <td className="py-3 pr-3"><div className="ml-auto h-3 w-14 rounded-control bg-line" /></td>
                      <td className="py-3 pr-3"><div className="h-4 w-16 rounded-full bg-line" /></td>
                      <td className="py-3 pr-3"><div className="h-2.5 w-36 rounded-control bg-line" /></td>
                      <td className="py-3"><div className="ml-auto h-3 w-12 rounded-control bg-line" /></td>
                    </tr>
                  ))
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-ink-4">
                      No stock transactions found.
                    </td>
                  </tr>
                ) : (
                  data.items.map((tx) => (
                    <tr key={tx.id} className="hover:bg-canvas align-top">
                      <td className="py-3 pr-3 text-xs text-ink-2 tabular-nums">
                        <span className="block whitespace-nowrap">{formatDateOnly(tx.created_dtm)}</span>
                        <span className="block text-2xs uppercase tracking-wide text-ink-4">
                          {tx.family}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="truncate text-sm font-medium text-ink">
                          {serviceLabel(family, tx.servicetype)}
                        </p>
                        <p className="truncate font-mono text-2xs text-ink-4" title={tx.type || undefined}>
                          {tx.type || '—'}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="truncate text-xs text-ink-2" title={tx.description || undefined}>
                          {tx.description || '—'}
                        </p>
                        <p className="truncate font-mono text-2xs text-ink-4" title={tx.voucher_type_code || undefined}>
                          {tx.voucher_type_code || '—'}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-xs text-ink-2 tabular-nums">
                        <span className="block truncate" title={tx.destination_msisdn || undefined}>
                          {tx.destination_msisdn || '—'}
                        </span>
                        {tx.source_msisdn && (
                          <span className="block truncate text-2xs text-ink-4" title={`from ${tx.source_msisdn}`}>
                            from {tx.source_msisdn}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right text-xs tabular-nums">
                        <span className="block font-semibold text-ink">
                          {tx.voucher_price ? formatIDR(tx.voucher_price) : '—'}
                        </span>
                        {tx.price_normal && tx.price_normal !== tx.voucher_price && (
                          <span className="block text-2xs text-ink-4">{formatIDR(tx.price_normal)}</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="py-3 pr-3">
                        <RefCell
                          label="trx"
                          value={tx.master_trx_id}
                          copiedKey={copiedKey}
                          onCopy={handleCopy}
                        />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <Link
                            href={`/dashboard/stock/history/${tx.family}/${tx.id}`}
                            className="text-xs text-primary hover:text-primary-hover underline"
                          >
                            Detail
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleRecheck(tx.id)}
                            disabled={recheckingId === tx.id}
                            className="text-xs text-ink-2 hover:text-ink underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {recheckingId === tx.id ? 'Checking...' : 'Re-check'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 xl:hidden">
            {loading && !data ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`sk-${i}`} className="animate-pulse rounded-surface border border-line p-4">
                  <div className="h-3 w-24 rounded-control bg-line" />
                  <div className="mt-2 h-2.5 w-32 rounded-control bg-line" />
                  <div className="mt-4 h-2.5 w-40 rounded-control bg-line" />
                </div>
              ))
            ) : !data || data.items.length === 0 ? (
              <p className="py-8 text-center text-ink-4">No stock transactions found.</p>
            ) : (
              data.items.map((tx) => (
                <div key={tx.id} className="rounded-surface border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {serviceLabel(family, tx.servicetype)}
                      </p>
                      <p className="truncate font-mono text-2xs text-ink-4">{tx.type || '—'}</p>
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between col-span-2">
                      <dt className="text-ink-3">Product</dt>
                      <dd className="truncate text-ink-2" title={tx.description || undefined}>
                        {tx.description || '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <dt className="text-ink-3">Date</dt>
                      <dd className="text-ink-2 tabular-nums">{formatDateOnly(tx.created_dtm)}</dd>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <dt className="text-ink-3">Destination</dt>
                      <dd className="text-ink-2 tabular-nums">{tx.destination_msisdn || '—'}</dd>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <dt className="text-ink-3">Price</dt>
                      <dd className="font-semibold text-ink tabular-nums">
                        {tx.voucher_price ? formatIDR(tx.voucher_price) : '—'}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 border-t border-line pt-3">
                    <RefCell
                      label="trx"
                      value={tx.master_trx_id}
                      copiedKey={copiedKey}
                      onCopy={handleCopy}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <Link
                      href={`/dashboard/stock/history/${tx.family}/${tx.id}`}
                      className="text-xs text-primary hover:text-primary-hover underline"
                    >
                      Detail
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRecheck(tx.id)}
                      disabled={recheckingId === tx.id}
                      className="text-xs text-ink-2 hover:text-ink underline disabled:opacity-50"
                    >
                      {recheckingId === tx.id ? 'Checking...' : 'Re-check'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {data && data.total > 0 && (
            <div className="mt-4 px-1 py-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <span className="text-sm text-ink-2">
                Page {data.page} of {data.total_pages} ({data.total} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.page <= 1}
                  className="px-3 py-1.5 text-sm border border-line-strong rounded-control disabled:opacity-50 disabled:cursor-not-allowed hover:bg-canvas"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={data.page >= data.total_pages}
                  className="px-3 py-1.5 text-sm border border-line-strong rounded-control disabled:opacity-50 disabled:cursor-not-allowed hover:bg-canvas"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
