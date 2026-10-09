'use client';

import { DashboardShell } from '../../../../components/DashboardShell';
import { useState } from 'react';
import { api } from '../../../../lib/api';
import { TransactionResult } from '../../../../types';
import { TransactionResultBox } from '../../../../components/TransactionResultBox';

export default function BuyPulsaPage() {
  const [msisdn, setMsisdn] = useState('');
  const [denom, setDenom] = useState('');
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const res = await api.buyPulsa({
        msisdn: msisdn.trim(),
        denom: parseInt(denom, 10),
      });
      setResult(res);
      setMsisdn('');
      setDenom('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Buy Pulsa</h1>
          <p className="mt-1 text-sm text-gray-500">
            Reload pulsa via W2P API. Enter the destination number and denomination.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow border p-6 max-w-xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="msisdn" className="block text-sm font-medium text-gray-700">
                MSISDN (Phone Number)
              </label>
              <input
                id="msisdn"
                type="text"
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value)}
                required
                placeholder="6281234567890"
                className="mt-1 block w-full rounded-md border border-gray-300 pl-3 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="denom" className="block text-sm font-medium text-gray-700">
                Denomination (IDR)
              </label>
              <input
                id="denom"
                type="text"
                value={denom}
                onChange={(e) => setDenom(e.target.value)}
                required
                placeholder="e.g. 5000, 10000, 25000"
                className="mt-1 block w-full rounded-md border border-gray-300 pl-3 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Processing...' : 'Buy Pulsa'}
            </button>
          </form>

          <TransactionResultBox result={result} error={error} />
        </div>
      </div>
    </DashboardShell>
  );
}