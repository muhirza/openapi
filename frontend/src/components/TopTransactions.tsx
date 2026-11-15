'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { LocalTransactionOut } from '../types';
import { formatIDR, formatDateOnly, formatTime } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import Link from 'next/link';

const TYPE_LABELS: Record<string, string> = {
  buy_pulsa: 'Beli Pulsa',
  buy_data_package: 'Paket Data',
  cocktail_sf: 'Cocktail SF',
  package_injection: 'Injeksi Paket',
  inject_awg: 'Injeksi AWG',
  inject_xwg: 'Injeksi XWG',
};

function typeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return TYPE_LABELS[type] ?? type;
}

/** Latest transactions from our own ledger — always current, unlike the provider list. */
export function TopTransactions() {
  const [items, setItems] = useState<LocalTransactionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getLocalTransactions({ page: 1, perPage: 5 });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat transaksi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-surface rounded-surface border border-line p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Transaksi terbaru</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="text-sm text-primary hover:text-primary-hover hover:bg-line font-medium disabled:opacity-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-control transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={loading ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
            </svg>
            {loading ? 'Memuat ulang...' : 'Muat ulang'}
          </button>
          <Link
            href="/dashboard/history"
            className="text-sm text-primary hover:text-primary-hover hover:bg-line font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-control transition-colors"
          >
            Lihat semua
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-danger-subtle border border-danger-border text-danger-strong px-4 py-3 rounded-control flex items-start">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 mr-2 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="font-medium">Gagal memuat transaksi</p>
            <p className="text-xs text-danger mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="text-center py-8 text-ink-4">Memuat...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-ink-4">Belum ada transaksi.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-3 uppercase tracking-wider border-b border-line">
                <th className="pb-2 pr-4">Produk</th>
                <th className="pb-2 pr-4 hidden md:table-cell">MSISDN</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4 text-right">Nominal</th>
                <th className="pb-2 text-right">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((tx) => (
                <tr key={tx.id} className="hover:bg-canvas focus-within:bg-canvas">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/dashboard/history/${tx.id}`}
                      className="block rounded-control font-medium text-ink hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {typeLabel(tx.transaction_type)}
                      <span className="block text-xs font-normal text-ink-3 truncate max-w-[260px]">
                        {tx.product_name || tx.product_code || '—'}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-ink-2 tabular-nums hidden md:table-cell">
                    {tx.destination || '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-ink tabular-nums">
                    {tx.amount ? formatIDR(tx.amount) : '—'}
                  </td>
                  <td className="py-3 text-right text-xs text-ink-3 whitespace-nowrap tabular-nums">
                    {formatDateOnly(tx.created_at)}
                    <span className="block text-ink-4">{formatTime(tx.created_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
