'use client';

import { DashboardShell } from '../../../components/DashboardShell';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { LocalTransactionListResponse, SyncSettings } from '../../../types';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatIDR, formatDate, formatDateOnly, formatTime, formatRelative } from '../../../lib/format';
import Link from 'next/link';

const TYPE_LABELS: Record<string, string> = {
  buy_pulsa: 'Buy Pulsa',
  buy_data_package: 'Data Package',
  cocktail_sf: 'Cocktail SF',
  package_injection: 'Package Injection',
  inject_awg: 'Inject AWG',
  inject_xwg: 'Inject XWG',
};

const RECHECKABLE_TYPES = ['buy_data_package', 'package_injection'];

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

function typeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return TYPE_LABELS[type] ?? type;
}

/** Compact copyable reference: truncates on screen, copies the full value. */
function RefCell({
  label,
  value,
  copiedKey,
  onCopy,
  mono = true,
}: {
  label: string;
  value: string | null | undefined;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
  mono?: boolean;
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
        className={`min-w-0 flex-1 break-all text-left text-2xs leading-snug text-ink-2 hover:text-primary-hover hover:underline ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </button>
      {copiedKey === key && <span className="shrink-0 text-2xs text-success-strong">copied</span>}
    </div>
  );
}

export default function LocalHistoryPage() {
  const [data, setData] = useState<LocalTransactionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [range, setRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [recheckingId, setRecheckingId] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.getSyncSettings().then(setSyncSettings).catch(() => {});
  }, []);

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
      const res = await api.getLocalTransactions({
        page,
        perPage,
        type: filterType || undefined,
        status: filterStatus || undefined,
        source: filterSource || undefined,
        search: debouncedSearch || undefined,
        startDate,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filterType, filterStatus, filterSource, debouncedSearch, startDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filterType, filterStatus, filterSource, debouncedSearch, range]);

  const handleRecheck = async (id: number) => {
    setRecheckingId(id);
    setError('');
    try {
      await api.refreshTransaction(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-check transaction');
    } finally {
      setRecheckingId(null);
    }
  };

  const handleToggleSync = async () => {
    if (!syncSettings) return;
    setSyncBusy(true);
    setSyncNotice('');
    try {
      setSyncSettings(await api.updateSyncSettings({ enabled: !syncSettings.enabled }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update auto-sync');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleIntervalChange = async (minutes: number) => {
    setSyncBusy(true);
    try {
      setSyncSettings(await api.updateSyncSettings({ interval_minutes: minutes }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sync interval');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncBusy(true);
    setSyncNotice('');
    setError('');
    try {
      const res = await api.runSyncNow();
      setSyncNotice(res.added > 0 ? `Synced ${res.added} new transaction(s).` : 'Already up to date.');
      setSyncSettings(await api.getSyncSettings());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {}
  };

  const hasFilters = Boolean(filterType || filterStatus || filterSource || debouncedSearch || range !== 'all');
  const summary = data?.summary ?? null;

  return (
    <DashboardShell>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Transaction History</h1>
          <p className="mt-1 text-sm text-ink-3">
            Transactions executed in the dashboard plus history synced from the provider.
          </p>
        </div>

        <div className="mb-4 rounded-surface border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">Auto-sync provider history</h2>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ${
                    syncSettings?.enabled
                      ? 'bg-success-subtle text-success-strong'
                      : 'bg-line text-ink-3'
                  }`}
                >
                  {syncSettings?.enabled ? 'On' : 'Off'}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-3">
                The provider only returns its latest ~2,500 transactions. With auto-sync on,
                history is copied into the local database on a schedule so older transactions
                stay available.
              </p>
              {syncSettings?.last_sync_at && (
                <p className="mt-1.5 text-xs text-ink-3">
                  Last synced {formatDate(syncSettings.last_sync_at)}
                  {syncSettings.last_sync_status && (
                    <span
                      className={
                        syncSettings.last_sync_status === 'FAILED'
                          ? ' text-danger-strong'
                          : ' text-success-strong'
                      }
                    >
                      {' '}· {syncSettings.last_sync_status.toLowerCase()}
                    </span>
                  )}
                  {syncSettings.last_sync_count != null &&
                    ` (${syncSettings.last_sync_count} new)`}
                  {syncSettings.enabled &&
                    syncSettings.next_sync_at &&
                    ` · next ${formatRelative(syncSettings.next_sync_at)}`}
                </p>
              )}
              {syncSettings?.last_sync_error && (
                <p className="mt-1 text-xs text-danger-strong">
                  Last error: {syncSettings.last_sync_error}
                </p>
              )}
              {syncNotice && <p className="mt-1 text-xs text-success-strong">{syncNotice}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-ink-3">
                Every
                <select
                  value={syncSettings?.interval_minutes ?? 60}
                  onChange={(e) => handleIntervalChange(Number(e.target.value))}
                  disabled={syncBusy}
                  className="rounded-control border border-line-strong px-2 py-1.5 text-sm text-ink focus:border-primary focus:ring-primary disabled:opacity-50"
                >
                  <option value={15}>15 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={360}>6 hours</option>
                  <option value={1440}>24 hours</option>
                </select>
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(syncSettings?.enabled)}
                onClick={handleToggleSync}
                disabled={syncBusy || !syncSettings}
                title={syncSettings?.enabled ? 'Turn auto-sync off' : 'Turn auto-sync on'}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  syncSettings?.enabled ? 'bg-success-strong' : 'bg-line-strong'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    syncSettings?.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
                <span className="sr-only">
                  {syncSettings?.enabled ? 'Disable auto-sync' : 'Enable auto-sync'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncBusy}
                className="rounded-control border border-line-strong px-3 py-1.5 text-sm text-ink-2 hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncBusy ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-surface shadow border p-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, MSISDN, or product..."
              aria-label="Search transactions"
              className="w-72 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filter by type"
              className="w-44 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
            >
              <option value="">All Types</option>
              <option value="buy_pulsa">Buy Pulsa</option>
              <option value="buy_data_package">Buy Data Package</option>
              <option value="cocktail_sf">Cocktail SF</option>
              <option value="package_injection">Package Injection</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              aria-label="Filter by source"
              className="w-36 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
            >
              <option value="">All Sources</option>
              <option value="app">App</option>
              <option value="synced">Synced</option>
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
                    range === value
                      ? 'bg-primary text-white'
                      : 'text-ink-2 hover:bg-line'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button
                onClick={() => {
                  setFilterType('');
                  setFilterStatus('');
                  setFilterSource('');
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

          {/* Quick status filters — counts come from the other active filters */}
          {summary && summary.total > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-canvas px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
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
              <span className="text-xs text-ink-2">
                Successful value{' '}
                <span className="font-semibold text-ink tabular-nums">
                  {formatIDR(String(summary.success_amount))}
                </span>
              </span>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-danger-subtle border border-danger-border text-danger-strong px-4 py-3 rounded-control text-sm">
              {error}
            </div>
          )}

          {/* Desktop: fixed-layout table that always fits the container */}
          <div className="hidden xl:block">
            <table className="w-full table-fixed divide-y divide-line">
              <colgroup>
                <col className="w-[100px]" />
                <col className="w-[14%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[26%]" />
                <col className="w-[100px]" />
              </colgroup>
              <thead>
                <tr className="text-left text-2xs font-semibold text-ink-3 uppercase tracking-wider">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Type / Product</th>
                  <th className="pb-2 pr-3">Destination</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Reference</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && !data ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="animate-pulse">
                      <td className="py-3 pr-3">
                        <div className="h-3 w-16 rounded-control bg-line" />
                        <div className="mt-1.5 h-2.5 w-10 rounded-control bg-line" />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="h-3 w-24 rounded-control bg-line" />
                        <div className="mt-1.5 h-2.5 w-32 rounded-control bg-line" />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="h-3 w-20 rounded-control bg-line" />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="ml-auto h-3 w-14 rounded-control bg-line" />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="h-4 w-16 rounded-full bg-line" />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="h-2.5 w-40 rounded-control bg-line" />
                        <div className="mt-1.5 h-2.5 w-32 rounded-control bg-line" />
                      </td>
                      <td className="py-3">
                        <div className="ml-auto h-3 w-16 rounded-control bg-line" />
                      </td>
                    </tr>
                  ))
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-ink-4">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  data.items.map((tx) => (
                    <tr key={tx.id} className="hover:bg-canvas align-top">
                      <td className="py-3 pr-3 text-xs text-ink-2 tabular-nums" title={formatRelative(tx.created_at)}>
                        <span className="block whitespace-nowrap">{formatDateOnly(tx.created_at)}</span>
                        <span className="block text-ink-4">{formatTime(tx.created_at)}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                          <span className="truncate">{typeLabel(tx.transaction_type)}</span>
                          {tx.source === 'synced' && (
                            <span className="shrink-0 rounded-full bg-line px-1.5 py-px text-2xs font-medium uppercase tracking-wide text-ink-3">
                              synced
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-ink-3" title={tx.product_name || tx.product_code || undefined}>
                          {tx.product_name || tx.product_code || '—'}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-xs text-ink-2 tabular-nums">
                        <span className="block truncate" title={tx.destination || undefined}>
                          {tx.destination || '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right text-sm font-semibold text-ink tabular-nums">
                        {tx.amount ? formatIDR(tx.amount) : '—'}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="space-y-0.5">
                          <RefCell label="prov" value={tx.provider_reference} copiedKey={copiedKey} onCopy={handleCopy} />
                          <RefCell label="local" value={tx.transaction_ref} copiedKey={copiedKey} onCopy={handleCopy} />
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <Link
                            href={`/dashboard/history/${tx.id}`}
                            className="text-xs text-primary hover:text-primary-hover underline"
                          >
                            Detail
                          </Link>
                          {RECHECKABLE_TYPES.includes(tx.transaction_type) && (
                            <button
                              type="button"
                              onClick={() => handleRecheck(tx.id)}
                              disabled={recheckingId === tx.id}
                              className="text-xs text-ink-2 hover:text-ink underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {recheckingId === tx.id ? 'Re-checking...' : 'Re-check'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet: card layout (never scrolls sideways) */}
          <div className="space-y-3 xl:hidden">
            {loading && !data ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`sk-${i}`} className="animate-pulse rounded-surface border border-line p-4">
                  <div className="h-3 w-24 rounded-control bg-line" />
                  <div className="mt-2 h-2.5 w-32 rounded-control bg-line" />
                  <div className="mt-4 h-2.5 w-40 rounded-control bg-line" />
                  <div className="mt-3 h-2.5 w-28 rounded-control bg-line" />
                </div>
              ))
            ) : !data || data.items.length === 0 ? (
              <p className="py-8 text-center text-ink-4">No transactions found.</p>
            ) : (
              data.items.map((tx) => (
                <div key={tx.id} className="rounded-surface border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        <span className="truncate">{typeLabel(tx.transaction_type)}</span>
                        {tx.source === 'synced' && (
                          <span className="shrink-0 rounded-full bg-line px-1.5 py-px text-2xs font-medium uppercase tracking-wide text-ink-3">
                            synced
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-ink-3">
                        {tx.product_name || tx.product_code || '—'}
                      </p>
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="flex justify-between col-span-2">
                      <dt className="text-ink-3">Date</dt>
                      <dd className="text-ink-2 tabular-nums" title={formatRelative(tx.created_at)}>
                        {formatDateOnly(tx.created_at)} {formatTime(tx.created_at)}
                      </dd>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <dt className="text-ink-3">Destination</dt>
                      <dd className="text-ink-2 tabular-nums">{tx.destination || '—'}</dd>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <dt className="text-ink-3">Amount</dt>
                      <dd className="font-semibold text-ink tabular-nums">
                        {tx.amount ? formatIDR(tx.amount) : '—'}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 space-y-1 border-t border-line pt-3">
                    <RefCell label="prov" value={tx.provider_reference} copiedKey={copiedKey} onCopy={handleCopy} />
                    <RefCell label="local" value={tx.transaction_ref} copiedKey={copiedKey} onCopy={handleCopy} />
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <Link
                      href={`/dashboard/history/${tx.id}`}
                      className="text-xs text-primary hover:text-primary-hover underline"
                    >
                      Detail
                    </Link>
                    {RECHECKABLE_TYPES.includes(tx.transaction_type) && (
                      <button
                        type="button"
                        onClick={() => handleRecheck(tx.id)}
                        disabled={recheckingId === tx.id}
                        className="text-xs text-ink-2 hover:text-ink underline disabled:opacity-50"
                      >
                        {recheckingId === tx.id ? 'Re-checking...' : 'Re-check'}
                      </button>
                    )}
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
