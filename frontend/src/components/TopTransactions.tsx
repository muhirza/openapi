'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { HistoryResponse } from '../types';
import { formatIDR, formatDate } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import Link from 'next/link';

export function TopTransactions() {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // 30 days window; we show the 5 most recent on the Home page
      const data = await api.getApiHistory(30);
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const items = history?.items ?? [];
  const top5 = items.slice(0, 5);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Latest Transactions</h2>
        <Link
          href="/dashboard/history"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          View All
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 mr-2 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="font-medium">Unable to load transactions</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && !history ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : top5.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No transactions found in this period.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="pb-2 pr-4">Product</th>
                <th className="pb-2 pr-4 hidden md:table-cell">MSISDN</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4 text-right font-normal">Amount</th>
                <th className="pb-2 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {top5.map((tx, i) => (
                <tr key={tx.transaction_ref || i} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">
                    {tx.transaction_type}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 hidden md:table-cell">
                    {tx.destination || '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-gray-900">
                    {tx.amount ? formatIDR(tx.amount) : '—'}
                  </td>
                  <td className="py-3 text-right text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(tx.date)}
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