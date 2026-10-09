'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { ProductOut } from '../types';
import { formatIDR } from '../lib/format';

interface ProductSelectProps {
  value: string;
  onChange: (productCode: string) => void;
}

/**
 * Searchable product select.
 * Fetches the full active catalog (all pages) and lets the user search
 * by name, code, or brand. Options show "Product name - price - brand".
 */
export function ProductSelect({ value, onChange }: ProductSelectProps) {
  const [products, setProducts] = useState<ProductOut[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const all: ProductOut[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await api.getProducts({ active: true, page, perPage: 100 });
          all.push(...res.products);
          totalPages = res.total_pages;
          page += 1;
        } while (page <= totalPages && page <= 50); // safety cap
        setProducts(all);
      } catch {}
    };
    loadAll();
  }, []);

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
          placeholder="Search product name, code, or brand..."
          className="block w-full rounded-md border border-gray-300 pl-3 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full text-left rounded-md border border-gray-300 pl-3 pr-3 py-2 text-sm bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-blue-500"
        >
          {selected ? formatLabel(selected) : 'Search products...'}
        </button>
      )}

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">No products found.</div>
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
                  i === highlight ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">{p.product_name || p.product_code}</span>
                <span className="text-gray-400"> - </span>
                {p.price ? <span className="text-gray-700">{formatIDR(p.price)}</span> : null}
                {p.owner ? (
                  <>
                    <span className="text-gray-400"> - </span>
                    <span className="text-gray-600">{p.owner}</span>
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
