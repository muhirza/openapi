'use client';

import { DashboardShell } from '../../../../components/DashboardShell';
import { useState } from 'react';
import { api } from '../../../../lib/api';
import { TransactionResult } from '../../../../types';
import { TransactionResultBox } from '../../../../components/TransactionResultBox';
import { ProductSelect } from '../../../../components/ProductSelect';

export default function CocktailSFPage() {
  const [productCode, setProductCode] = useState('');
  const [targetsText, setTargetsText] = useState('');
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setError('');
    setLoading(true);

    if (!productCode) {
      setError('Please select a product');
      setLoading(false);
      return;
    }

    const targets = targetsText
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (targets.length === 0) {
      setError('Enter at least one target SN');
      setLoading(false);
      return;
    }

    try {
      const res = await api.cocktailSF({
        product_code: productCode,
        targets,
      });
      setResult(res);
      setProductCode('');
      setTargetsText('');
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
          <h1 className="text-2xl font-bold text-gray-900">Cocktail SF</h1>
          <p className="mt-1 text-sm text-gray-500">
            Inject VD SF vouchers to one or more target SNs.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow border p-6 max-w-xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="product" className="block text-sm font-medium text-gray-700">
                Product (search name, code, or brand)
              </label>
              <div className="mt-1">
                <ProductSelect value={productCode} onChange={setProductCode} />
              </div>
            </div>

            <div>
              <label htmlFor="targets" className="block text-sm font-medium text-gray-700">
                Target SNs (one per line or comma-separated)
              </label>
              <textarea
                id="targets"
                value={targetsText}
                onChange={(e) => setTargetsText(e.target.value)}
                required
                rows={4}
                placeholder="004550000010989&#10;004550000010990"
                className="mt-1 block w-full rounded-md border border-gray-300 pl-3 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Processing...' : 'Inject Cocktail SF'}
            </button>
          </form>

          <TransactionResultBox result={result} error={error} />
        </div>
      </div>
    </DashboardShell>
  );
}
