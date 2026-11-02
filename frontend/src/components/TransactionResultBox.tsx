'use client';

import { TransactionResult } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatIDR, formatDate } from '../lib/format';

interface TransactionResultBoxProps {
  result: TransactionResult | null;
  error: string;
  historyHref?: string;
}

export function TransactionResultBox({
  result,
  error,
  historyHref = '/dashboard/history',
}: TransactionResultBoxProps) {
  if (error) {
    return (
      <div className="mt-4 bg-danger-subtle border border-danger-border text-danger-strong px-4 py-3 rounded-control text-sm">
        {error}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div
      className={`mt-4 px-4 py-3 rounded-control text-sm border ${
        result.status === 'SUCCESS'
          ? 'bg-success-subtle border-success-border text-success-strong'
          : result.status === 'PROCESSING'
          ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
          : 'bg-danger-subtle border-danger-border text-danger-strong'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <StatusBadge status={result.status} />
          <span className="font-medium">{result.message}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div className="min-w-0 break-words">
          <span className="text-ink-3">Reference:</span>{' '}
          <span className="font-mono break-all">{result.transaction_ref}</span>
        </div>
        {result.provider_reference && (
          <div className="min-w-0 break-words">
            <span className="text-ink-3">Provider Ref:</span>{' '}
            <span className="font-mono break-all">{result.provider_reference}</span>
          </div>
        )}
        {result.destination && (
          <div className="min-w-0 break-words">
            <span className="text-ink-3">Destination:</span> {result.destination}
          </div>
        )}
        {result.amount && (
          <div className="min-w-0 break-words">
            <span className="text-ink-3">Amount:</span> {formatIDR(result.amount)}
          </div>
        )}
        {result.created_at && (
          <div className="min-w-0 break-words">
            <span className="text-ink-3">Time:</span> {formatDate(result.created_at)}
          </div>
        )}
      </div>
      <div className="mt-2">
        <a
          href={historyHref}
          className="text-xs underline text-primary hover:text-primary-hover"
        >
          View in History →
        </a>
      </div>
    </div>
  );
}
