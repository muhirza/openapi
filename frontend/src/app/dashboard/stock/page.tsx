'use client';

import { DashboardShell } from '../../../components/DashboardShell';
import { TransactionResultBox } from '../../../components/TransactionResultBox';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { StockFamily, StockItem, StockListResponse, TransactionResult } from '../../../types';
import { formatIDR, formatDate, formatDateOnly } from '../../../lib/format';
import Link from 'next/link';

const FAMILIES: { key: StockFamily; label: string }[] = [
  { key: 'xwg', label: 'XWG' },
  { key: 'awg', label: 'AWG' },
];

function parseTargets(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

interface InjectDialogProps {
  item: StockItem;
  family: StockFamily;
  onClose: (reload: boolean) => void;
}

function InjectDialog({ item, family, onClose }: InjectDialogProps) {
  const [targetsText, setTargetsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [error, setError] = useState('');

  const targets = parseTargets(targetsText);
  const historyHref = `/dashboard/stock/history?family=${family}`;

  // Escape closes the dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose(result !== null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, result]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (targets.length === 0) {
      setError('Enter at least one target MSISDN');
      return;
    }
    if (!item.voucher_id) {
      setError('This stock row has no voucher ID to inject');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.stockInject({
        family,
        targets,
        voucher_id: item.voucher_id,
        allow_type: item.allow_type || '',
        voucher_type_code: item.voucher_type_code,
        description: item.description,
        price: item.voucher_price,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Injection failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/50"
        onClick={() => !submitting && onClose(result !== null)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inject-title"
        className="relative w-full max-w-lg rounded-surface bg-surface shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="inject-title" className="text-lg font-semibold text-ink">
              Inject {family.toUpperCase()} stock
            </h2>
            <p className="mt-0.5 text-sm text-ink-3">
              {item.description || item.voucher_type_code}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose(result !== null)}
            aria-label="Close"
            disabled={submitting}
            className="rounded-control p-1 text-ink-4 hover:bg-line hover:text-ink-2 disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-control bg-canvas px-4 py-3 text-sm">
            <div className="flex justify-between col-span-2">
              <dt className="text-ink-3">Voucher code</dt>
              <dd className="break-all text-right font-mono text-xs text-ink">
                {item.voucher_type_code}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">Price</dt>
              <dd className="font-semibold text-ink tabular-nums">
                {item.voucher_price ? formatIDR(item.voucher_price) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">Stock</dt>
              <dd className="text-ink tabular-nums">{item.voucher_balance}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">Allow type</dt>
              <dd className="text-ink">{item.allow_type || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">Expires</dt>
              <dd className="text-ink tabular-nums">{item.voucher_exp_date || '—'}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <label htmlFor="targets" className="block text-sm font-medium text-ink-2">
              Target MSISDNs (one per line or comma-separated)
            </label>
            <textarea
              id="targets"
              value={targetsText}
              onChange={(e) => setTargetsText(e.target.value)}
              rows={3}
              placeholder="6287787237069&#10;6287884074088"
              className="mt-1 block w-full rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
            />
            <p className="mt-1 text-xs text-ink-3">
              {targets.length > 0
                ? `${targets.length} target${targets.length === 1 ? '' : 's'}`
                : 'Uses the transaction PIN saved in API Config.'}
            </p>
          </div>

          {error && (
            <div role="alert" className="mt-3 rounded-control border border-danger-border bg-danger-subtle px-4 py-2.5 text-sm text-danger-strong">
              {error}
            </div>
          )}

          <div className="mt-4">
            <TransactionResultBox result={result} error="" historyHref={historyHref} />
            {result && (
              <div className="mt-3 text-sm text-ink-2">
                Verification runs in the background. Track it in{' '}
                <Link href={historyHref} className="font-medium text-primary underline hover:text-primary-hover">
                  Stock History
                </Link>
                .
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onClose(result !== null)}
              disabled={submitting}
              className="rounded-control border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:bg-canvas disabled:opacity-50"
            >
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button
                type="submit"
                disabled={submitting || targets.length === 0}
                className="rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : `Inject${targets.length > 0 ? ` (${targets.length})` : ''}`}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StockPage() {
  const [family, setFamily] = useState<StockFamily>('xwg');
  const [roType, setRoType] = useState('MINI-GROSIR');
  const [data, setData] = useState<StockListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [injecting, setInjecting] = useState<StockItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getStock(family, family === 'xwg' ? roType || undefined : undefined);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [family, roType]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {}
  };

  const credentialsMissing = error.toLowerCase().includes('credentials');
  const allItems = data?.items ?? [];
  const query = search.trim().toLowerCase();
  const items = useMemo(
    () =>
      query
        ? allItems.filter(
            (item) =>
              item.voucher_type_code.toLowerCase().includes(query) ||
              (item.description ?? '').toLowerCase().includes(query),
          )
        : allItems,
    [allItems, query],
  );

  const injectButton = (item: StockItem, index: number) => (
    <button
      type="button"
      onClick={() => setInjecting(item)}
      disabled={!item.voucher_id}
      title={item.voucher_id ? 'Inject this stock to one or more targets' : 'This stock row has no voucher ID'}
      className="rounded-control border border-primary-border bg-primary-subtle px-2.5 py-1 text-xs font-medium text-primary-hover transition-colors hover:bg-primary-subtle disabled:cursor-not-allowed disabled:border-line disabled:bg-canvas disabled:text-ink-4"
    >
      Inject
    </button>
  );

  return (
    <DashboardShell>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Digital Stock</h1>
          <p className="mt-1 text-sm text-ink-3">
            Available voucher stock for the AWG and XWG families.
          </p>
        </div>

        <div className="bg-surface rounded-surface shadow border p-6">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="inline-flex rounded-control border border-line-strong p-0.5 text-sm" role="group" aria-label="Stock family">
              {FAMILIES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFamily(f.key)}
                  aria-pressed={family === f.key}
                  className={`rounded-control px-3 py-1.5 font-medium transition-colors ${
                    family === f.key ? 'bg-primary text-white' : 'text-ink-2 hover:bg-line'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {family === 'xwg' && (
              <div className="flex items-center gap-2">
                <label htmlFor="rotype" className="text-sm text-ink-2">
                  roType
                </label>
                <input
                  id="rotype"
                  type="text"
                  value={roType}
                  onChange={(e) => setRoType(e.target.value)}
                  placeholder="MINI-GROSIR"
                  className="w-44 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
                />
              </div>
            )}

            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voucher code or description..."
                aria-label="Search stock"
                className="w-72 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-1 flex items-center rounded-control px-2 text-lg leading-none text-ink-4 hover:text-ink-2"
                >
                  ×
                </button>
              )}
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="text-sm text-primary hover:text-primary-hover hover:bg-line font-medium disabled:opacity-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-control transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={loading ? 'animate-spin' : ''}>
                <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
              </svg>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Summary */}
          {data && !error && (
            <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-control border border-line bg-canvas px-4 py-3 text-sm">
              <span className="text-ink-2">
                {query ? (
                  <>
                    <span className="font-semibold text-ink tabular-nums">{items.length}</span> of{' '}
                    <span className="font-semibold text-ink tabular-nums">{data.total}</span> stocks
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-ink tabular-nums">{data.total}</span> stock
                    {data.total === 1 ? '' : 's'}
                  </>
                )}{' '}
                · {data.family.toUpperCase()}
                {data.ro_type ? ` · ${data.ro_type}` : ''}
              </span>
              <span className="text-ink-2">
                Vouchers <span className="font-semibold text-ink tabular-nums">{data.total_vouchers}</span>
              </span>
              <span className="text-ink-2">
                Stock value{' '}
                <span className="font-semibold text-ink tabular-nums">
                  {formatIDR(String(data.stock_value))}
                </span>
              </span>
              <span className="text-xs text-ink-4 ml-auto">Fetched {formatDate(data.fetched_at)}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-control border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger-strong"
            >
              <p className="font-medium">Unable to load {family.toUpperCase()} stock</p>
              <p className="mt-0.5">{error}</p>
              {credentialsMissing && (
                <Link href="/dashboard/config" className="mt-1 inline-block font-medium text-primary-hover underline hover:text-primary-hover">
                  Add {family.toUpperCase()} credentials in API Config →
                </Link>
              )}
            </div>
          )}

          {/* Desktop table */}
          <div className="hidden xl:block">
            <table className="w-full table-fixed divide-y divide-line">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[24%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-2xs font-semibold text-ink-3 uppercase tracking-wider">
                  <th className="pb-2 pr-3">Voucher Code</th>
                  <th className="pb-2 pr-3">Description</th>
                  <th className="pb-2 pr-3 text-right">Price</th>
                  <th className="pb-2 pr-3 text-right">Stock</th>
                  <th className="pb-2 pr-3">Effective</th>
                  <th className="pb-2 pr-3">Expires</th>
                  <th className="pb-2 pr-3 text-right">vID</th>
                  <th className="pb-2 text-right">Inject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && !data ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="animate-pulse">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="py-3 pr-3">
                          <div className="h-3 w-full rounded-control bg-line" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-ink-4">
                      {error ? '—' : query ? `No stock matches “${search.trim()}”.` : 'No stock available.'}
                    </td>
                  </tr>
                ) : (
                  items.map((item, i) => (
                    <tr key={`${item.voucher_type_code}-${i}`} className="hover:bg-canvas align-top">
                      <td className="py-3 pr-3">
                        <span className="block break-all font-mono text-xs text-ink">
                          {item.voucher_type_code}
                        </span>
                        {item.allow_type && (
                          <span className="mt-0.5 inline-block rounded-control bg-line px-1.5 py-0.5 text-2xs uppercase text-ink-3">
                            {item.allow_type}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-ink-2">{item.description || '—'}</td>
                      <td className="py-3 pr-3 text-right text-sm font-semibold text-ink tabular-nums">
                        {item.voucher_price ? formatIDR(item.voucher_price) : '—'}
                      </td>
                      <td className="py-3 pr-3 text-right text-sm text-ink tabular-nums">
                        {item.voucher_balance}
                      </td>
                      <td className="py-3 pr-3 text-xs text-ink-2 tabular-nums">
                        {item.effective_date ? formatDateOnly(item.effective_date) : '—'}
                      </td>
                      <td className="py-3 pr-3 text-xs text-ink-2 tabular-nums">
                        {item.voucher_exp_date ? formatDateOnly(item.voucher_exp_date) : item.expiration_date ? formatDateOnly(item.expiration_date) : '—'}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {item.voucher_id ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(`vid:${i}`, item.voucher_id as string)}
                            title={item.voucher_id}
                            className="text-xs text-primary hover:text-primary-hover underline"
                          >
                            {copiedKey === `vid:${i}` ? 'Copied' : 'Copy ID'}
                          </button>
                        ) : (
                          <span className="text-xs text-ink-4">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">{injectButton(item, i)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Small screens: cards */}
          <div className="space-y-3 xl:hidden">
            {loading && !data ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`sk-${i}`} className="animate-pulse rounded-surface border border-line p-4">
                  <div className="h-3 w-32 rounded-control bg-line" />
                  <div className="mt-2 h-2.5 w-48 rounded-control bg-line" />
                  <div className="mt-3 h-2.5 w-24 rounded-control bg-line" />
                </div>
              ))
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-ink-4">
                {error ? '—' : query ? `No stock matches “${search.trim()}”.` : 'No stock available.'}
              </p>
            ) : (
              items.map((item, i) => (
                <div key={`${item.voucher_type_code}-${i}`} className="rounded-surface border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="break-all font-mono text-xs font-medium text-ink">
                      {item.voucher_type_code}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                      {item.voucher_price ? formatIDR(item.voucher_price) : '—'}
                    </span>
                  </div>
                  {item.description && <p className="mt-1.5 text-xs text-ink-2">{item.description}</p>}
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-ink-3">Stock</dt>
                      <dd className="text-ink tabular-nums">{item.voucher_balance}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-3">Allow</dt>
                      <dd className="text-ink-2">{item.allow_type || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-3">Effective</dt>
                      <dd className="text-ink-2 tabular-nums">{item.effective_date || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-3">Expires</dt>
                      <dd className="text-ink-2 tabular-nums">{item.voucher_exp_date || '—'}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {item.voucher_id ? (
                      <button
                        type="button"
                        onClick={() => handleCopy(`vid:${i}`, item.voucher_id as string)}
                        title={item.voucher_id}
                        className="text-xs text-primary hover:text-primary-hover underline"
                      >
                        {copiedKey === `vid:${i}` ? 'vID copied' : 'Copy vID'}
                      </button>
                    ) : (
                      <span />
                    )}
                    {injectButton(item, i)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {injecting && (
          <InjectDialog
            item={injecting}
            family={family}
            onClose={(reload) => {
              setInjecting(null);
              if (reload) load();
            }}
          />
        )}
      </div>
    </DashboardShell>
  );
}
