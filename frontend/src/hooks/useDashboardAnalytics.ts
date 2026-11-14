'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type {
  AnalyticsRange,
  NonDigitalAnalyticsResponse,
} from '../types';

export function useDashboardAnalytics(range: AnalyticsRange) {
  const [data, setData] = useState<NonDigitalAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    api
      .getDashboardAnalytics(range)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load analytics'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, version]);

  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return { data, loading, error, refresh };
}
