'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { TokenStatus } from '../types';
import { formatDate } from '../lib/format';
import { IconRefresh, IconAlertCircle, IconCheckCircle, IconClock } from './icons';

interface TokenState {
  label: string;
  dotClass: string;
  textClass: string;
  pillClass: string;
  message: string;
}

/** Derive actionable token state from the TokenStatus payload */
function deriveTokenState(status: TokenStatus | null): TokenState {
  if (!status || !status.has_token) {
    return {
      label: 'TIDAK ADA TOKEN',
      dotClass: 'bg-ink-4',
      textClass: 'text-ink-3',
      pillClass: 'bg-line text-ink-2',
      message: 'Belum ada token API yang dikonfigurasi.',
    };
  }
  if (!status.is_valid) {
    return {
      label: 'KEDALUWARSA',
      dotClass: 'bg-danger',
      textClass: 'text-danger',
      pillClass: 'bg-danger-subtle text-danger-strong',
      message: 'Token API Anda telah kedaluwarsa.',
    };
  }
  // is_valid === true: check if expiring soon (< 10 minutes)
  if (status.expires_at) {
    const expMs = new Date(status.expires_at).getTime();
    if (!isNaN(expMs) && expMs - Date.now() < 10 * 60 * 1000) {
      return {
        label: 'SEGERA KEDALUWARSA',
        dotClass: 'bg-warning',
        textClass: 'text-warning',
        pillClass: 'bg-warning-subtle text-warning-strong',
        message: 'Token API Anda akan segera kedaluwarsa. Pertimbangkan untuk memuat ulang.',
      };
    }
  }
  return {
    label: 'AKTIF',
    dotClass: 'bg-success',
    textClass: 'text-success-strong',
    pillClass: 'bg-success-subtle text-success-strong',
    message: 'Token API Anda aktif.',
  };
}

interface TokenCardProps {
  compact?: boolean;
}

export function TokenCard({ compact = false }: TokenCardProps) {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.getTokenStatus();
      setStatus(data);
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load token status:', err);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRefresh = async () => {
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const result = await api.refreshToken();
      if (result.success) {
        setMessage('Token berhasil dimuat ulang');
        await loadStatus();
      } else {
        setError(result.error || 'Gagal memuat ulang token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat ulang token');
    } finally {
      setLoading(false);
    }
  };

  const state = deriveTokenState(status);

  if (compact) {
    const pending = !status && !loadError;
    const label = pending ? 'MEMERIKSA' : status ? state.label : 'TIDAK DIKETAHUI';
    const pillClass =
      pending || !status ? 'bg-line text-ink-2' : state.pillClass;
    const dotClass = pending || !status ? 'bg-ink-4' : state.dotClass;

    return (
      <div className="flex h-full flex-col bg-surface rounded-surface border border-line p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-3">API token</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-semibold ${pillClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
            {label}
          </span>
        </div>

        <p className="mt-3 text-sm font-semibold text-ink">
          {pending
            ? 'Memeriksa token…'
            : !status
            ? 'Gagal memuat status token.'
            : status.has_token && status.is_valid && status.expires_at
            ? `Kedaluwarsa ${formatDate(status.expires_at)}`
            : state.message}
        </p>

        <div className="mt-auto pt-3">
          {message && (
            <p className="text-xs text-success-strong">{message}</p>
          )}
          {error && <p className="text-xs text-danger-strong">{error}</p>}
          {loadError && !status && (
            <p className="text-xs text-warning-strong">Coba muat ulang di bawah.</p>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="mt-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover hover:underline disabled:opacity-50"
          >
            {loading ? 'Memuat ulang…' : 'Muat ulang token'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-surface border border-line p-6">
      {/* Header with status pill */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Status Token</h2>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${state.pillClass}`}
        >
          <span className={`w-2 h-2 rounded-full ${state.dotClass}`} />
          {state.label}
        </span>
      </div>

      {/* Load failure notice */}
      {loadError && !status && (
        <div className="mb-4 bg-warning-subtle border border-warning-border text-warning-strong px-4 py-3 rounded-control flex items-start">
          <IconAlertCircle size={16} className="mt-0.5 mr-2 shrink-0" />
          <span className="text-sm">
            Gagal memuat status token. Layanan mungkin sedang offline — coba muat
            ulang di bawah.
          </span>
        </div>
      )}

      {message && (
        <div className="mb-4 bg-success-subtle border border-success-border text-success-strong px-4 py-3 rounded-control flex items-start">
          <IconCheckCircle size={16} className="mt-0.5 mr-2 shrink-0" />
          <span className="text-sm">{message}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-danger-subtle border border-danger-border text-danger-strong px-4 py-3 rounded-control flex items-start">
          <IconAlertCircle size={16} className="mt-0.5 mr-2 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Status details */}
      <div className="space-y-3 mb-6">
        <p className="text-sm text-ink-2">{state.message}</p>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-3">Token tersedia:</span>
          <span
            className={`text-sm font-medium ${
              status?.has_token ? 'text-ink' : 'text-ink-4'
            }`}
          >
            {status?.has_token ? 'Ya' : 'Tidak'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-3">Status:</span>
          <span className={`text-sm font-semibold ${state.textClass}`}>
            {status?.is_valid ? 'Valid' : status?.has_token ? 'Kedaluwarsa' : 'Tidak ada'}
          </span>
        </div>

        {status?.expires_at && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-3">Kedaluwarsa pada:</span>
            <span className="text-sm text-ink flex items-center">
              <IconClock size={14} className="mr-1.5 text-ink-4" />
              {formatDate(status.expires_at)}
            </span>
          </div>
        )}
      </div>

      {/* Refresh button — prominent, full-width */}
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="w-full bg-primary text-white py-2.5 px-4 rounded-control hover:bg-primary-hover disabled:opacity-50 font-medium flex items-center justify-center gap-2"
      >
        <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Mengambil Token...' : 'Muat Ulang Token'}
      </button>
    </div>
  );
}
