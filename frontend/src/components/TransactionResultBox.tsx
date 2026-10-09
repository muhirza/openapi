'use client';

import { TransactionResult } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatIDR, formatDate } from '../lib/format';

interface TransactionResultBoxProps {
  result: TransactionResult | null;
  error: string;
}

export function TransactionResultBox({ result, error }: TransactionResultBoxProps) {
  if (error) {
    return (
      <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
        {error}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div
      className={`mt-4 px-4 py-3 rounded text-sm border ${
        result.status === 'SUCCESS'
          ? 'bg-green-50 border-green-200 text-green-700'
          : result.status === 'PROCESSING'
          ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
          : 'bg-red-50 border-red-200 text-red-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <StatusBadge status={result.status} />
          <span className="font-medium">{result.message}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div>
          <span className="text-gray-500">Reference:</span>{' '}
          <span className="font-mono">{result.transaction_ref}</span>
        </div>
        {result.provider_reference && (
          <div>
            <span className="text-gray-500">Provider Ref:</span>{' '}
            <span className="font-mono">{result.provider_reference}</span>
          </div>
        )}
        {result.destination && (
          <div>
            <span className="text-gray-500">Destination:</span> {result.destination}
          </div>
        )}
        {result.amount && (
          <div>
            <span className="text-gray-500">Amount:</span> {formatIDR(result.amount)}
          </div>
        )}
        {result.created_at && (
          <div>
            <span className="text-gray-500">Time:</span> {formatDate(result.created_at)}
          </div>
        )}
      </div>
      <div className="mt-2">
        <a
          href="/dashboard/history"
          className="text-xs underline text-blue-600 hover:text-blue-800"
        >
          View in History →
        </a>
      </div>
    </div>
  );
}
