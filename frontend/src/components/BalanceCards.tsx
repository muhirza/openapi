'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { BalanceSummary } from '../types';
import { formatIDR } from '../lib/format';
import { IconZap, IconWallet, IconRefresh, IconAlertCircle } from './icons';

// Icons stay neutral: hue is reserved for status, not decoration.
const BALANCE_CARDS = [
  {
    key: 'eload' as const,
    title: 'Eload Balance',
    subtitle: 'Saldo Eload',
    icon: <IconZap size={20} />,
  },
  {
    key: 'dompul' as const,
    title: 'Dompul Balance',
    subtitle: 'Saldo Dompul',
    icon: <IconWallet size={20} />,
  },
];

export function BalanceCards() {
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getBalances();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Account Balances</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm text-primary hover:text-primary-hover hover:bg-line font-medium disabled:opacity-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-control transition-colors"
        >
          <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-danger-subtle border border-danger-border text-danger-strong px-4 py-3 rounded-control flex items-start">
          <IconAlertCircle size={16} className="mt-0.5 mr-2 shrink-0" />
          <span className="text-sm">Unable to load balances. {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BALANCE_CARDS.map((card) => {
          const data = summary?.[card.key];
          const failed = summary && !data;

          return (
            <div
              key={card.key}
              className="bg-surface rounded-surface border border-line p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink-3 truncate">{card.subtitle}</p>
                <div
                  className={`w-10 h-10 rounded-surface flex items-center justify-center shrink-0 ${
                    failed ? 'bg-warning-subtle text-warning' : 'bg-surface-muted text-ink-3'
                  }`}
                >
                  {card.icon}
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-ink tabular-nums">
                {loading && !summary ? '…' : data ? formatIDR(data.balance) : '—'}
              </p>
              {failed && (
                <div className="mt-1.5">
                  <p className="text-xs font-medium text-warning-strong">Unable to retrieve balance</p>
                  <Link
                    href="/dashboard/config"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover hover:underline"
                  >
                    Check API Config
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}