'use client';

import { DashboardShell } from '../../../components/DashboardShell';
import { ProductList } from '../../../components/ProductList';

export default function ProductsPage() {
  return (
    <DashboardShell>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse and manage your product catalog. Sync to fetch the latest from
            the provider.
          </p>
        </div>
        <ProductList />
      </div>
    </DashboardShell>
  );
}