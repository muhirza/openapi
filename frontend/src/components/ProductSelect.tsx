'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { ProductOut } from '../types';
import { formatIDR } from '../lib/format';

interface ProductSelectProps {
  value: string;
  onChange: (productCode: string) => void;
  /** Restrict listing to products whose product_type matches this exactly (e.g. "VD Cocktail Plan"). */
  productType?: string;
  /** Omit products whose product_type matches any of these exactly (e.g. ["SP Cocktail Plan", "VD Cocktail Plan"]). */
  excludeProductTypes?: string[];
}

/**
 * Searchable product select.
 * Fetches the full active catalog (all pages) and lets the user search
 * by name, code, or brand. Options show "Product name - price - brand".
 * When productType is set, only products of that type are listed;
 * when excludeProductTypes is set, products of those types are omitted.
 */
export function ProductSelect({ value, onChange, productType, excludeProductTypes }: ProductSelectProps) {
  const [products, setProducts] = useState<ProductOut[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const excludeKey = (excludeProductTypes ?? []).join('\u0001');

  useEffect(() => {
    const excludes = excludeKey ? excludeKey.split('\u0001') : [];
    const loadAll = async () => {
      try {
        const all: ProductOut[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await api.getProducts({ active: true, productType, page, perPage: 100 });
          all.push(...res.products);
          totalPages = res.total_pages;
          page += 1;
        } while (page <= totalPages && page <= 50); // safety cap
        setProducts(all.filter((p) => !excludes.includes(p.product_type ?? '')));
      } catch {}
    };
    loadAll();
  }, [productType, excludeKey]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search
    ? products.filter((p) => {
        const q = search.toLowerCase();
        return (
          (p.product_name || '').toLowerCase().includes(q) ||
          p.product_code.toLowerCase().includes(q) ||
          (p.owner || '').toLowerCase().includes(q) ||
          (p.product_type || '').toLowerCase().includes(q)
        );
      })
    : products;

  const selected = products.find((p) => p.product_code === value);

  const formatLabel = (p: ProductOut) => {
    const parts = [
      p.product_name || p.product_code,
      p.price ? formatIDR(p.price) : undefined,
      p.owner || undefined,
    ].filter(Boolean);
    return parts.join(' - ');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Selected display + search trigger */}
      {open ? (
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setHighlight(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (highlight >= 0 && filtered[highlight]) {
                onChange(filtered[highlight].product_code);
                setSearch('');
                setOpen(false);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
              setSearch('');
            }
          }}
          placeholder={productType ? `Search ${productType} products...` : 'Search product name, code, or brand...'}
          className="block w-full rounded-control border border-line-strong pl-3 pr-3 py-2 text-sm focus:border-primary focus:ring-primary"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full text-left rounded-control border border-line-strong pl-3 pr-3 py-2 text-sm bg-surface hover:border-ink-4 focus:border-primary focus:ring-primary"
        >
          {selected ? formatLabel(selected) : 'Search products...'}
        </button>
      )}

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-control border border-line bg-surface shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-4">
              {productType ? `No ${productType} products found.` : 'No products found.'}
            </div>
          ) : (
            filtered.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.product_code);
                  setSearch('');
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`block w-full text-left px-3 py-2 text-sm ${
                  i === highlight ? 'bg-primary-subtle text-primary-hover' : 'text-ink-2 hover:bg-canvas'
                }`}
              >
                <span className="font-medium">{p.product_name || p.product_code}</span>
                <span className="text-ink-4"> - </span>
                {p.price ? <span className="text-ink-2">{formatIDR(p.price)}</span> : null}
                {p.owner ? (
                  <>
                    <span className="text-ink-4"> - </span>
                    <span className="text-ink-2">{p.owner}</span>
                  </>
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
