'use client';

import { DashboardShell } from '../../../../components/DashboardShell';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { LocalTransactionDetail } from '../../../../types';
import { StatusBadge } from '../../../../components/StatusBadge';
import { formatIDR, formatDate } from '../../../../lib/format';

export default function LocalHistoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [tx, setTx] = useState<LocalTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getLocalTransaction(id);
      setTx(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!tx) return;
    setRefreshing(true);
    setError('');
    try {
      const res = await api.refreshTransaction(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading && !tx) {
    return (
      <DashboardShell>
        <div className="text-center py-8 text-gray-400">Loading...</div>
      </DashboardShell>
    );
  }

  if (!tx) {
    return (
      <DashboardShell>
        <div className="text-center py-8 text-red-500">{error || 'Transaction not found'}</div>
      </DashboardShell>
    );
  }

  const canRefresh = ['buy_data_package', 'package_injection'].includes(tx.transaction_type) &&
    tx.status === 'PROCESSING';

  return (
    <DashboardShell>
      <div>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transaction Detail</h1>
            <p className="mt-1 text-sm text-gray-500">
              Ref: {tx.transaction_ref}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={tx.status} />
            {canRefresh && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Status'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow border p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs text-gray-500">Reference</label>
              <p className="font-mono text-sm text-gray-900">{tx.transaction_ref}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Provider Reference</label>
              <p className="font-mono text-sm text-gray-900">{tx.provider_reference || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Type</label>
              <p className="text-sm text-gray-900">{tx.transaction_type}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Product</label>
              <p className="text-sm text-gray-900">{tx.product_name || tx.product_code || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Product Code</label>
              <p className="font-mono text-sm text-gray-900">{tx.product_code || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Product Type</label>
              <p className="text-sm text-gray-900">{tx.product_type || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Destination</label>
              <p className="text-sm text-gray-900">{tx.destination || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Amount</label>
              <p className="text-sm text-gray-900">{tx.amount ? formatIDR(tx.amount) : '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Status</label>
              <p className="text-sm text-gray-900">{tx.status}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Created</label>
              <p className="text-sm text-gray-900">{formatDate(tx.created_at)}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Request Timestamp</label>
              <p className="text-sm text-gray-900">{formatDate(tx.request_timestamp)}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Response Timestamp</label>
              <p className="text-sm text-gray-900">{formatDate(tx.provider_response_timestamp)}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">HTTP Status</label>
              <p className="text-sm text-gray-900">{tx.http_status_code ?? '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Error Code</label>
              <p className="text-sm text-gray-900">{tx.error_code || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Error Message</label>
              <p className="text-sm text-gray-900">{tx.error_message || '—'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Metadata</h3>
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(tx.metadata, null, 2) || '{}'}
            </pre>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Raw Provider Response (masked)</h3>
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(tx.raw_response, null, 2) || '{}'}
            </pre>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}