'use client';

import { DashboardShell } from '../../../components/DashboardShell';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { LocalTransactionListResponse, SyncSettings } from '../../../types';
import { StatusBadge } from '../../../components/StatusBadge';
import { IconDownload } from '../../../components/icons';
import { formatIDR, formatDate, formatDateOnly, formatTime, formatRelative } from '../../../lib/format';
import Link from 'next/link';

const TYPE_LABELS: Record<string, string> = {
  buy_pulsa: 'Pulsa',
  buy_data_package: 'Paket Data',
  cocktail_sf: 'Cocktail PV SF',
  package_injection: 'Cocktail SP',
  inject_awg: 'Injeksi AWG',
  inject_xwg: 'Injeksi XWG',
};

const RECHECKABLE_TYPES = ['buy_data_package', 'package_injection'];

// Mirrors the backend MAX_EXPORT_ROWS cap.
const EXPORT_LIMIT = 20000;

const STATUS_CHIPS = [
  { key: '', label: 'Semua', tone: 'gray', count: (s: { total: number }) => s.total },
  { key: 'SUCCESS', label: 'Berhasil', tone: 'green', count: (s: { success: number }) => s.success },
  { key: 'FAILED', label: 'Gagal', tone: 'red', count: (s: { failed: number }) => s.failed },
  { key: 'PROCESSING', label: 'Diproses', tone: 'amber', count: (s: { processing: number }) => s.processing },
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
        <span className="w-16 shrink-0 text-2xs uppercase tracking-wide text-ink-4">{label}</span>
        <span className="text-xs text-ink-4">—</span>
      </div>
    );
  }
  const key = `${label}:${value}`;
  return (
    <div className="flex items-start gap-1.5">
      <span className="w-16 shrink-0 pt-px text-2xs uppercase tracking-wide text-ink-4">{label}</span>
      <button
        type="button"
        onClick={() => onCopy(key, value)}
        title={`${value} — klik untuk salin`}
        className={`min-w-0 flex-1 break-all text-left text-2xs leading-snug text-ink-2 hover:text-primary-hover hover:underline ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </button>
      {copiedKey === key && <span className="shrink-0 text-2xs text-success-strong">tersalin</span>}
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
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
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

  const quickStart = (() => {
    const now = new Date();
    if (range === 'today') return now.toISOString().slice(0, 10);
    if (range === '7d') return new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    if (range === '30d') return new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
    return undefined;
  })();

  const hasCustomRange = Boolean(customStart || customEnd);
  const startDate = hasCustomRange ? customStart || undefined : quickStart;
  const endDate = hasCustomRange ? customEnd || undefined : undefined;
  const invalidRange = Boolean(customStart && customEnd && customStart > customEnd);

  const load = useCallback(async () => {
    if (invalidRange) {
      setError('Tanggal mulai harus sama dengan atau sebelum tanggal akhir.');
      return;
    }
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
        endDate,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filterType, filterStatus, filterSource, debouncedSearch, startDate, endDate, invalidRange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filterType, filterStatus, filterSource, debouncedSearch, range, customStart, customEnd]);

  const handleRecheck = async (id: number) => {
    setRecheckingId(id);
    setError('');
    try {
      await api.refreshTransaction(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memeriksa ulang transaksi');
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
      setError(err instanceof Error ? err.message : 'Gagal memperbarui sinkronisasi otomatis');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleIntervalChange = async (minutes: number) => {
    setSyncBusy(true);
    try {
      setSyncSettings(await api.updateSyncSettings({ interval_minutes: minutes }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui interval sinkronisasi');
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
      setSyncNotice(res.added > 0 ? `Mensinkronkan ${res.added} transaksi baru.` : 'Sudah paling baru.');
      setSyncSettings(await api.getSyncSettings());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sinkronisasi gagal');
    } finally {
      setSyncBusy(false);
    }
  };

  const filteredTotal = data?.total ?? 0;
  const exportTooLarge = filteredTotal > EXPORT_LIMIT;
  const canExport = filteredTotal > 0 && !exportTooLarge;

  const handleExport = async () => {
    setExporting(true);
    setExportNotice('');
    setError('');
    try {
      await api.downloadHistoryExcel({
        type: filterType || undefined,
        status: filterStatus || undefined,
        source: filterSource || undefined,
        search: debouncedSearch || undefined,
        startDate,
        endDate,
      });
      setExportNotice(`Mengekspor ${filteredTotal.toLocaleString()} transaksi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ekspor gagal');
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {}
  };

  const hasFilters = Boolean(
    filterType || filterStatus || filterSource || debouncedSearch || range !== 'all' || hasCustomRange
  );
  const summary = data?.summary ?? null;

  return (
    <DashboardShell>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Riwayat Transaksi</h1>
          <p className="mt-1 text-sm text-ink-3">
            Transaksi yang dijalankan di dashboard beserta riwayat yang disinkronkan dari penyedia.
          </p>
        </div>

        <div className="mb-4 rounded-surface border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">Sinkronkan otomatis riwayat penyedia</h2>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ${
                    syncSettings?.enabled
                      ? 'bg-success-subtle text-success-strong'
                      : 'bg-line text-ink-3'
                  }`}
                >
                  {syncSettings?.enabled ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-3">
                Penyedia hanya mengembalikan sekitar 2.500 transaksi terbarunya. Dengan sinkronisasi
                otomatis aktif, riwayat disalin ke database lokal secara berkala agar transaksi
                lama tetap tersedia.
              </p>
              {syncSettings?.last_sync_at && (
                <p className="mt-1.5 text-xs text-ink-3">
                  Terakhir disinkronkan {formatDate(syncSettings.last_sync_at)}
                  {syncSettings.last_sync_status && (
                    <span
                      className={
                        syncSettings.last_sync_status === 'FAILED'
                          ? ' text-danger-strong'
                          : ' text-success-strong'
                      }
                    >
                      {' '}· {syncSettings.last_sync_status === 'FAILED' ? 'gagal' : 'berhasil'}
                    </span>
                  )}
                  {syncSettings.last_sync_count != null &&
                    ` (${syncSettings.last_sync_count} baru)`}
                  {syncSettings.enabled &&
                    syncSettings.next_sync_at &&
                    ` · berikutnya ${formatRelative(syncSettings.next_sync_at)}`}
                </p>
              )}
              {syncSettings?.last_sync_error && (
                <p className="mt-1 text-xs text-danger-strong">
                  Error terakhir: {syncSettings.last_sync_error}
                </p>
              )}
              {syncNotice && <p className="mt-1 text-xs text-success-strong">{syncNotice}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-ink-3">
                Setiap
                <select
                  value={syncSettings?.interval_minutes ?? 60}
                  onChange={(e) => handleIntervalChange(Number(e.target.value))}
                  disabled={syncBusy}
                  className="rounded-control border border-line-strong px-2 py-1.5 text-sm text-ink focus:border-primary focus:ring-primary disabled:opacity-50"
                >
                  <option value={15}>15 menit</option>
                  <option value={60}>1 jam</option>
                  <option value={360}>6 jam</option>
                  <option value={1440}>24 jam</option>
                </select>
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(syncSettings?.enabled)}
                onClick={handleToggleSync}
                disabled={syncBusy || !syncSettings}
                title={syncSettings?.enabled ? 'Matikan sinkronisasi otomatis' : 'Aktifkan sinkronisasi otomatis'}
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
                  {syncSettings?.enabled ? 'Nonaktifkan sinkronisasi otomatis' : 'Aktifkan sinkronisasi otomatis'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncBusy}
                className="rounded-control border border-line-strong px-3 py-1.5 text-sm text-ink-2 hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncBusy ? 'Menyinkronkan…' : 'Sinkronkan sekarang'}
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
              placeholder="Cari referensi, MSISDN, atau produk..."
              aria-label="Cari transaksi"
              className="w-72 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filter berdasarkan tipe"
              className="w-44 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
            >
              <option value="">Semua Tipe</option>
              <option value="buy_pulsa">Pulsa</option>
              <option value="buy_data_package">Beli Paket Data</option>
              <option value="cocktail_sf">Cocktail PV SF</option>
              <option value="package_injection">Cocktail SP</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              aria-label="Filter berdasarkan sumber"
              className="w-36 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
            >
              <option value="">Semua Sumber</option>
              <option value="app">Aplikasi</option>
              <option value="synced">Tersinkron</option>
            </select>
            <div className="inline-flex rounded-control border border-line-strong p-0.5 text-sm" role="group" aria-label="Filter berdasarkan rentang tanggal">
              {([
                ['all', 'Semua waktu'],
                ['today', 'Hari ini'],
                ['7d', '7 hari'],
                ['30d', '30 hari'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setRange(value);
                    setCustomStart('');
                    setCustomEnd('');
                  }}
                  aria-pressed={!hasCustomRange && range === value}
                  className={`rounded-control px-2.5 py-1.5 transition-colors ${
                    !hasCustomRange && range === value
                      ? 'bg-primary text-white'
                      : 'text-ink-2 hover:bg-line'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className={`flex items-center gap-1.5 text-sm ${
                hasCustomRange ? 'rounded-control border border-primary bg-primary-subtle px-2 py-1' : ''
              }`}
            >
              <label htmlFor="history-date-from" className="text-xs text-ink-3">
                Dari
              </label>
              <input
                id="history-date-from"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setRange('all');
                  setPage(1);
                }}
                className="rounded-control border border-line-strong px-2 py-1.5 text-sm focus:border-primary focus:ring-primary"
              />
              <span className="text-ink-4">–</span>
              <label htmlFor="history-date-to" className="text-xs text-ink-3">
                Sampai
              </label>
              <input
                id="history-date-to"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setRange('all');
                  setPage(1);
                }}
                className="rounded-control border border-line-strong px-2 py-1.5 text-sm focus:border-primary focus:ring-primary"
              />
              {hasCustomRange && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStart('');
                    setCustomEnd('');
                  }}
                  className="text-xs text-ink-3 hover:text-ink-2 underline"
                >
                  Atur ulang
                </button>
              )}
            </div>
            {hasFilters && (
              <button
                onClick={() => {
                  setFilterType('');
                  setFilterStatus('');
                  setFilterSource('');
                  setSearch('');
                  setRange('all');
                  setCustomStart('');
                  setCustomEnd('');
                  setPage(1);
                }}
                className="text-sm text-ink-3 hover:text-ink-2 underline"
              >
                Hapus filter
              </button>
            )}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              {exportNotice && <span className="text-xs text-success-strong">{exportNotice}</span>}
              {invalidRange && (
                <span className="text-xs text-danger-strong">
                  Tanggal mulai harus sama dengan atau sebelum tanggal akhir.
                </span>
              )}
              {!invalidRange && exportTooLarge && (
                <span className="text-xs text-warning-strong">
                  Hasil filter berisi {filteredTotal.toLocaleString()} baris — persempit rentang tanggal
                  untuk mengekspor (batas {EXPORT_LIMIT.toLocaleString()}).
                </span>
              )}
              {!invalidRange && !exportTooLarge && filteredTotal === 0 && !loading && (
                <span className="text-xs text-ink-3">Tidak ada baris yang cocok dengan filter ini untuk diekspor.</span>
              )}
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || !canExport || invalidRange}
                className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconDownload size={16} />
                {exporting
                  ? 'Mengekspor…'
                  : `Ekspor Excel${filteredTotal ? ` (${filteredTotal.toLocaleString()})` : ''}`}
              </button>
            </div>
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
                Nilai berhasil{' '}
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
                  <th className="pb-2 pr-3">Tanggal</th>
                  <th className="pb-2 pr-3">Tipe / Produk</th>
                  <th className="pb-2 pr-3">Tujuan</th>
                  <th className="pb-2 pr-3 text-right">Nominal</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Referensi</th>
                  <th className="pb-2 text-right">Aksi</th>
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
                      Transaksi tidak ditemukan.
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
                              tersinkron
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
                          <RefCell label="penyedia" value={tx.provider_reference} copiedKey={copiedKey} onCopy={handleCopy} />
                          <RefCell label="lokal" value={tx.transaction_ref} copiedKey={copiedKey} onCopy={handleCopy} />
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
                              {recheckingId === tx.id ? 'Memeriksa ulang...' : 'Periksa ulang'}
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
              <p className="py-8 text-center text-ink-4">Transaksi tidak ditemukan.</p>
            ) : (
              data.items.map((tx) => (
                <div key={tx.id} className="rounded-surface border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        <span className="truncate">{typeLabel(tx.transaction_type)}</span>
                        {tx.source === 'synced' && (
                          <span className="shrink-0 rounded-full bg-line px-1.5 py-px text-2xs font-medium uppercase tracking-wide text-ink-3">
                            tersinkron
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
                      <dt className="text-ink-3">Tanggal</dt>
                      <dd className="text-ink-2 tabular-nums" title={formatRelative(tx.created_at)}>
                        {formatDateOnly(tx.created_at)} {formatTime(tx.created_at)}
                      </dd>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <dt className="text-ink-3">Tujuan</dt>
                      <dd className="text-ink-2 tabular-nums">{tx.destination || '—'}</dd>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <dt className="text-ink-3">Nominal</dt>
                      <dd className="font-semibold text-ink tabular-nums">
                        {tx.amount ? formatIDR(tx.amount) : '—'}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 space-y-1 border-t border-line pt-3">
                    <RefCell label="penyedia" value={tx.provider_reference} copiedKey={copiedKey} onCopy={handleCopy} />
                    <RefCell label="lokal" value={tx.transaction_ref} copiedKey={copiedKey} onCopy={handleCopy} />
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
                        {recheckingId === tx.id ? 'Memeriksa ulang...' : 'Periksa ulang'}
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
                Halaman {data.page} dari {data.total_pages} ({data.total} total)
                <span className="ml-2 text-xs text-ink-4">
                  Ekspor mencakup semua baris yang cocok dengan filter saat ini, bukan hanya halaman ini.
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.page <= 1}
                  className="px-3 py-1.5 text-sm border border-line-strong rounded-control disabled:opacity-50 disabled:cursor-not-allowed hover:bg-canvas"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={data.page >= data.total_pages}
                  className="px-3 py-1.5 text-sm border border-line-strong rounded-control disabled:opacity-50 disabled:cursor-not-allowed hover:bg-canvas"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
