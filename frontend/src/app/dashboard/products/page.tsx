'use client';

import { DashboardShell } from '../../../components/DashboardShell';
import { ProductList } from '../../../components/ProductList';

export default function ProductsPage() {
  return (
    <DashboardShell>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Produk</h1>
          <p className="mt-1 text-sm text-ink-3">
            Telusuri dan kelola katalog produk Anda. Sinkronkan untuk mengambil data
            terbaru dari penyedia.
          </p>
        </div>
        <ProductList />
      </div>
    </DashboardShell>
  );
}