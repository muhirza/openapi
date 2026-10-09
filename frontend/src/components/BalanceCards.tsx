'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { BalanceSummary } from '../types';
import { formatIDR } from '../lib/format';
import { IconZap, IconWallet, IconCoins, IconRefresh, IconAlertCircle } from './icons';

const BALANCE_CARDS = [
  {
    key: 'eload' as const,
    title: 'Eload Balance',
    subtitle: 'Saldo Eload',
    icon: <IconZap size={20} />,
    iconCls: 'bg-amber-50 text-amber-600',
  },
  {
    key: 'dompul' as const,
    title: 'Dompul Balance',
    subtitle: 'Saldo Dompul',
    icon: <IconWallet size={20} />,
    iconCls: 'bg-blue-50 text-blue-600',
  },
  {
    key: 'pulsa' as const,
    title: 'Pulsa Balance',
    subtitle: 'Saldo Pulsa',
    icon: <IconCoins size={20} />,
    iconCls: 'bg-green-50 text-green-600',
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
        <h2 className="text-lg font-semibold text-gray-900">Account Balances</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start">
          <IconAlertCircle size={16} className="mt-0.5 mr-2 shrink-0" />
          <span className="text-sm">Unable to load balances. {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BALANCE_CARDS.map((card) => {
          const data = summary?.[card.key];
          const failed = summary && !data;

          return (
            <div
              key={card.key}
              className="bg-white rounded-lg border border-gray-200 p-5 flex items-center justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500 truncate">{card.subtitle}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {loading && !summary ? '…' : data ? formatIDR(data.balance) : '—'}
                </p>
                {failed && (
                  <div className="mt-1.5">
                    <p className="text-xs font-medium text-amber-700">Unable to retrieve balance</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Check {card.key} API credentials
                    </p>
                  </div>
                )}
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.iconCls}`}>
                {card.icon}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}