'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { ProductListResponse, SyncProductResult } from '../types';
import { formatIDR, formatRelative, activeBadgeClass } from '../lib/format';

type ActiveFilter = 'all' | 'active' | 'inactive';
type SortField = 'product_code' | 'product_name' | 'product_type' | 'owner' | 'price' | 'active' | 'last_synced_at';

export function ProductList() {
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filter, setFilter] = useState<ActiveFilter>('all');
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [productType, setProductType] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncProductResult | null>(null);

  // Debounce name input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(name), 300);
    return () => clearTimeout(t);
  }, [name]);

  // Reset page when filters/sort change
  useEffect(() => { setPage(1); }, [filter, brand, debouncedName, productType, sortField]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getProducts({
        active: filter === 'all' ? null : filter === 'active',
        brand: brand || undefined,
        name: debouncedName || undefined,
        productType: productType || undefined,
        page,
        perPage,
        sortBy: sortField || undefined,
        sortDir: sortField ? sortDir : undefined,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [filter, brand, debouncedName, productType, page, perPage, sortField, sortDir]);

  // Initial load + reload when params change
  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError('');
    try {
      const res = await api.syncProducts();
      setSyncResult(res);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync products');
    } finally {
      setSyncing(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const startIndex = data ? ((data.page ?? 1) - 1) * (data.per_page ?? 25) + 1 : 0;
  const endIndex = data ? Math.min((data.page ?? 1) * (data.per_page ?? 25), data.total) : 0;
  const currentPage = data?.page ?? 1;
  const totalPages = data?.total_pages ?? 1;

  return (
    <div className="bg-surface rounded-surface shadow border">
      {/* Header */}
      <div className="p-6 border-b border-line">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Products</h2>
            <p className="mt-1 text-sm text-ink-3">
              {data
                ? `Showing ${startIndex}–${endIndex} of ${data.total} products • ${data.active_count} active • ${data.inactive_count} inactive`
                : 'Loading...'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-control shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : '↻ Sync'}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Brand */}
          <select
            value={brand}
            onChange={(e) => { setBrand(e.target.value); setPage(1); }}
            className="w-48 rounded-control border border-line-strong pl-3 pr-3 py-2 text-sm focus:border-primary focus:ring-primary"
          >
            <option value="">All Brands</option>
            {data?.brands?.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Product Name */}
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setPage(1); }}
            placeholder="Product name..."
            className="w-64 rounded-control border border-line-strong pl-3 pr-3 py-2 text-sm focus:border-primary focus:ring-primary"
          />

          {/* Product Type */}
          <select
            value={productType}
            onChange={(e) => { setProductType(e.target.value); setPage(1); }}
            className="w-48 rounded-control border border-line-strong pl-3 pr-3 py-2 text-sm focus:border-primary focus:ring-primary"
          >
            <option value="">All Types</option>
            {data?.product_types?.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Active Filter */}
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as ActiveFilter); setPage(1); }}
            className="w-32 rounded-control border border-line-strong py-2 px-3 text-sm focus:border-primary focus:ring-primary"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Clear filters */}
          {brand || name || productType || filter !== 'all' ? (
            <button
              onClick={() => {
                setBrand(''); setName(''); setProductType(''); setFilter('all'); setPage(1);
              }}
              className="text-sm text-ink-3 hover:text-ink-2 underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {/* Sync result banner */}
        {syncResult && (
          <div
            className={`mt-4 px-4 py-3 rounded-control text-sm ${
              syncResult.success
                ? 'bg-success-subtle border border-success-border text-success-strong'
                : 'bg-danger-subtle border border-danger-border text-danger-strong'
            }`}
          >
            {syncResult.success ? (
              <>
                Sync complete — {syncResult.inserted} added,{' '}
                {syncResult.updated} updated, {syncResult.deactivated}{' '}
                deactivated.
                {syncResult.synced_at &&
                  ` (${formatRelative(syncResult.synced_at)})`}
              </>
            ) : (
              syncResult.error || 'Sync failed'
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-danger-subtle border border-danger-border text-danger-strong px-4 py-3 rounded-control text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-canvas">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wider cursor-pointer hover:bg-line"
                onClick={() => toggleSort('product_code')}
              >
                Code{getSortIcon('product_code')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wider cursor-pointer hover:bg-line"
                onClick={() => toggleSort('product_name')}
              >
                Name{getSortIcon('product_name')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wider cursor-pointer hover:bg-line"
                onClick={() => toggleSort('product_type')}
              >
                Type{getSortIcon('product_type')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wider cursor-pointer hover:bg-line"
                onClick={() => toggleSort('owner')}
              >
                Brand{getSortIcon('owner')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wider cursor-pointer hover:bg-line"
                onClick={() => toggleSort('price')}
              >
                Price{getSortIcon('price')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wider cursor-pointer hover:bg-line"
                onClick={() => toggleSort('active')}
              >
                Status{getSortIcon('active')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wider cursor-pointer hover:bg-line"
                onClick={() => toggleSort('last_synced_at')}
              >
                Last Synced{getSortIcon('last_synced_at')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && !data ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-ink-4">
                  Loading...
                </td>
              </tr>
            ) : !data || data.products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-ink-4">
                  No products found. Try syncing first.
                </td>
              </tr>
            ) : (
              data.products.map((p) => (
                <tr key={p.id} className="hover:bg-canvas">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ink">
                    {p.product_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-2">
                    {p.product_name || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-2">
                    {p.product_type || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-2">
                    {p.owner || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-2">
                    {p.price ? formatIDR(p.price) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={activeBadgeClass(p.active)}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-3">
                    {formatRelative(p.last_synced_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="px-6 py-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-2">
              Page {currentPage} of {totalPages}
            </span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="ml-2 rounded-control border border-line-strong py-1 px-2 text-sm focus:border-primary focus:ring-primary"
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 text-sm border border-line-strong rounded-control disabled:opacity-50 disabled:cursor-not-allowed hover:bg-canvas"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 text-sm border border-line-strong rounded-control disabled:opacity-50 disabled:cursor-not-allowed hover:bg-canvas"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}