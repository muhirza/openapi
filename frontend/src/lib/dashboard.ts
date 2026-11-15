import type { AnalyticsRange } from '../types';

export const ANALYTICS_RANGES: ReadonlyArray<{
  key: AnalyticsRange;
  label: string;
}> = [
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: '90d', label: '90 hari' },
  { key: 'month', label: 'Bulan ini' },
];

export const TRANSACTION_TYPE_ORDER = [
  'buy_pulsa',
  'buy_data_package',
  'package_injection',
  'cocktail_sf',
] as const;

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  buy_pulsa: 'Beli Pulsa',
  buy_data_package: 'Paket Data',
  package_injection: 'Injeksi Paket',
  cocktail_sf: 'Cocktail SF',
};

const BRAND_COLORS: Record<string, string> = {
  SF: '#1D4ED8',
  SMARTFREN: '#1D4ED8',
  XL: '#0EA5E9',
  AXIS: '#94A3B8',
  Unknown: '#CBD5E1',
};

const FALLBACK_BRAND_COLORS = [
  '#1D4ED8',
  '#0EA5E9',
  '#94A3B8',
  '#2563EB',
  '#0284C7',
];

/** Deterministic brand colour for dynamic brand names. */
export function brandColor(brand: string): string {
  if (BRAND_COLORS[brand]) return BRAND_COLORS[brand];

  let hash = 0;
  for (let index = 0; index < brand.length; index += 1) {
    hash = (hash * 31 + brand.charCodeAt(index)) >>> 0;
  }
  return FALLBACK_BRAND_COLORS[hash % FALLBACK_BRAND_COLORS.length];
}
