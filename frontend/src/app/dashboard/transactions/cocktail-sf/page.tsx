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
      setError('Pilih produk terlebih dahulu');
      setLoading(false);
      return;
    }

    const targets = targetsText
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (targets.length === 0) {
      setError('Masukkan setidaknya satu SN tujuan');
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
      setError(err instanceof Error ? err.message : 'Transaksi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Cocktail PV SF</h1>
          <p className="mt-1 text-sm text-ink-3">
            Injeksikan voucher VD SF ke satu atau beberapa SN tujuan.
          </p>
        </div>

        <div className="bg-surface rounded-surface shadow border p-6 max-w-xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="product" className="block text-sm font-medium text-ink-2">
                Produk (cari nama, kode, atau brand)
              </label>
              <div className="mt-1">
                <ProductSelect value={productCode} onChange={setProductCode} productType="VD Cocktail Plan" />
              </div>
            </div>

            <div>
              <label htmlFor="targets" className="block text-sm font-medium text-ink-2">
                SN tujuan (satu per baris atau dipisahkan koma)
              </label>
              <textarea
                id="targets"
                value={targetsText}
                onChange={(e) => setTargetsText(e.target.value)}
                required
                rows={4}
                placeholder="004550000010989&#10;004550000010990"
                className="mt-1 block w-full rounded-control border border-line-strong pl-3 pr-3 py-2 text-sm focus:border-primary focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2 px-4 rounded-control hover:bg-primary-hover disabled:opacity-50 font-medium"
            >
              {loading ? 'Memproses...' : 'Injeksi Cocktail PV SF'}
            </button>
          </form>

          <TransactionResultBox result={result} error={error} />
        </div>
      </div>
    </DashboardShell>
  );
}
