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
      label: 'NO TOKEN',
      dotClass: 'bg-ink-4',
      textClass: 'text-ink-3',
      pillClass: 'bg-line text-ink-2',
      message: 'No API token configured yet.',
    };
  }
  if (!status.is_valid) {
    return {
      label: 'EXPIRED',
      dotClass: 'bg-danger',
      textClass: 'text-danger',
      pillClass: 'bg-danger-subtle text-danger-strong',
      message: 'Your API token has expired.',
    };
  }
  // is_valid === true: check if expiring soon (< 10 minutes)
  if (status.expires_at) {
    const expMs = new Date(status.expires_at).getTime();
    if (!isNaN(expMs) && expMs - Date.now() < 10 * 60 * 1000) {
      return {
        label: 'EXPIRING SOON',
        dotClass: 'bg-warning',
        textClass: 'text-warning',
        pillClass: 'bg-warning-subtle text-warning-strong',
        message: 'Your API token will expire soon. Consider refreshing it.',
      };
    }
  }
  return {
    label: 'ACTIVE',
    dotClass: 'bg-success',
    textClass: 'text-success-strong',
    pillClass: 'bg-success-subtle text-success-strong',
    message: 'Your API token is active.',
  };
}

export function TokenCard() {
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
        setMessage('Token refreshed successfully');
        await loadStatus();
      } else {
        setError(result.error || 'Failed to refresh token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh token');
    } finally {
      setLoading(false);
    }
  };

  const state = deriveTokenState(status);

  return (
    <div className="bg-surface rounded-surface border border-line p-6">
      {/* Header with status pill */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Token Status</h2>
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${state.pillClass}`}>
          <span className={`w-2 h-2 rounded-full ${state.dotClass}`} />
          {state.label}
        </span>
      </div>

      {/* Load failure notice */}
      {loadError && !status && (
        <div className="mb-4 bg-warning-subtle border border-warning-border text-warning-strong px-4 py-3 rounded-control flex items-start">
          <IconAlertCircle size={16} className="mt-0.5 mr-2 shrink-0" />
          <span className="text-sm">Unable to load token status. It may be offline — try refreshing below.</span>
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
          <span className="text-sm font-medium text-ink-3">Token exists:</span>
          <span className={`text-sm font-medium ${status?.has_token ? 'text-ink' : 'text-ink-4'}`}>
            {status?.has_token ? 'Yes' : 'No'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-3">Status:</span>
          <span className={`text-sm font-semibold ${state.textClass}`}>
            {status?.is_valid ? 'Valid' : status?.has_token ? 'Expired' : 'None'}
          </span>
        </div>

        {status?.expires_at && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-3">Expires at:</span>
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
        {loading ? 'Getting Token...' : 'Refresh Token'}
      </button>
    </div>
  );
}