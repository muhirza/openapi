import { BrandPerformance } from './BrandPerformance';
import { TypePerformance } from './TypePerformance';
import type {
  BrandPerformance as BrandPerformanceItem,
  TransactionTypePerformance,
} from '../../types';

interface PerformancePanelsProps {
  brands: BrandPerformanceItem[] | null;
  types: TransactionTypePerformance[] | null;
  loading: boolean;
}

export function PerformancePanels({
  brands,
  types,
  loading,
}: PerformancePanelsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <BrandPerformance brands={brands} loading={loading} />
      </div>
      <div className="lg:col-span-3">
        <TypePerformance types={types} loading={loading} />
      </div>
    </div>
  );
}
