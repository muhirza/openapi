'use client';

import { DashboardShell } from '../../../../components/DashboardShell';
import { useState } from 'react';
import { api } from '../../../../lib/api';
import { TransactionResult } from '../../../../types';
import { TransactionResultBox } from '../../../../components/TransactionResultBox';
import { StatusBadge } from '../../../../components/StatusBadge';
import { ProductSelect } from '../../../../components/ProductSelect';

export default function BuyDataPackagePage() {
  const [msisdn, setMsisdn] = useState('');
  const [productCode, setProductCode] = useState('');
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productCode) {
      setError('Please select a product');
      return;
    }
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const res = await api.buyDataPackage({
        msisdn: msisdn.trim(),
        product_code: productCode,
      });
      setResult(res);
      setMsisdn('');
      setProductCode('');
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
          <h1 className="text-2xl font-bold text-ink">Buy Data Package</h1>
          <p className="mt-1 text-sm text-ink-3">
            Select a data package from the product catalog. Status will be verified
            automatically after submission.
          </p>
        </div>

        <div className="bg-surface rounded-surface shadow border p-6 max-w-xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="msisdn" className="block text-sm font-medium text-ink-2">
                MSISDN (Phone Number)
              </label>
              <input
                id="msisdn"
                type="text"
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value)}
                required
                placeholder="6281234567890"
                className="mt-1 block w-full rounded-control border border-line-strong pl-3 pr-3 py-2 text-sm focus:border-primary focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="product" className="block text-sm font-medium text-ink-2">
                Product (search name, code, or brand)
              </label>
              <div className="mt-1">
                <ProductSelect
                  value={productCode}
                  onChange={setProductCode}
                  excludeProductTypes={['SP Cocktail Plan', 'VD Cocktail Plan']}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2 px-4 rounded-control hover:bg-primary-hover disabled:opacity-50 font-medium"
            >
              {loading ? 'Processing...' : 'Buy Data Package'}
            </button>
          </form>

          <TransactionResultBox result={result} error={error} />

          {result && result.status === 'PROCESSING' && (
            <div className="mt-4 text-xs text-ink-3">
              <p>
                Transaction is being processed. Final status will appear in{' '}
                <a href="/dashboard/history" className="text-primary underline">
                  History
                </a>{' '}
                — use the Refresh button there to re-check.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}