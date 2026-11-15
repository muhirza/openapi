'use client';

import { DashboardShell } from '../../../../components/DashboardShell';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { LocalTransactionDetail } from '../../../../types';
import { StatusBadge } from '../../../../components/StatusBadge';
import { formatIDR, formatDate } from '../../../../lib/format';

function buildCurl(tx: LocalTransactionDetail): { curl: string; masked: boolean } {
  const unmasked = tx.metadata_unmasked;
  if (unmasked && unmasked.request) {
    const endpoint = (unmasked.endpoint as string) || '<endpoint unavailable>';
    return {
      curl: `curl -X POST '${endpoint}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(unmasked.request)}'`,
      masked: false,
    };
  }
  // Older records: only the masked body is stored
  const maskedRequest = tx.metadata?.request ?? {};
  return {
    curl: `curl -X POST '<endpoint unavailable>' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(maskedRequest)}'`,
    masked: true,
  };
}

export default function LocalHistoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [tx, setTx] = useState<LocalTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showUnmasked, setShowUnmasked] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getLocalTransaction(id);
      setTx(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat transaksi');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!tx) return;
    setRefreshing(true);
    setError('');
    try {
      const res = await api.refreshTransaction(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat ulang');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading && !tx) {
    return (
      <DashboardShell>
        <div className="text-center py-8 text-ink-4">Memuat...</div>
      </DashboardShell>
    );
  }

  if (!tx) {
    return (
      <DashboardShell>
        <div className="text-center py-8 text-danger">{error || 'Transaksi tidak ditemukan'}</div>
      </DashboardShell>
    );
  }

  // Async provider flows can be re-verified at any time — including after a FAILED
  // result, which may have been recorded before the provider finished processing.
  const canRefresh = ['buy_data_package', 'package_injection'].includes(tx.transaction_type);

  const hasUnmasked = tx.metadata_unmasked != null || tx.raw_response_unmasked != null;
  const metadataDisplay = showUnmasked && tx.metadata_unmasked != null ? tx.metadata_unmasked : tx.metadata;
  const rawDisplay = showUnmasked && tx.raw_response_unmasked != null ? tx.raw_response_unmasked : tx.raw_response;

  const { curl, masked: curlMasked } = buildCurl(tx);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <DashboardShell>
      <div>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">Detail Transaksi</h1>
            <p className="mt-1 text-sm text-ink-3">
              Ref: {tx.transaction_ref}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={tx.status} />
            {canRefresh && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-3 py-1.5 text-sm border border-line-strong rounded-control hover:bg-canvas disabled:opacity-50"
              >
                {refreshing ? 'Memuat ulang...' : 'Muat Ulang Status'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowUnmasked((s) => !s)}
              aria-pressed={showUnmasked}
              className="px-3 py-1.5 text-sm border border-line-strong rounded-control hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {showUnmasked ? 'Sembunyikan data tanpa masking' : 'Tampilkan data tanpa masking'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-danger-subtle border border-danger-border text-danger-strong px-4 py-3 rounded-control text-sm">
            {error}
          </div>
        )}

        {showUnmasked && (
          <div className="mb-4 bg-warning-subtle border border-warning-border text-warning-strong px-4 py-3 rounded-control text-sm">
            {hasUnmasked ? (
              <>
                Tampilan tanpa masking — menampilkan data yang benar-benar dikirim ke dan
                diterima dari penyedia. Body request berisi PIN yang dienkripsi penyedia;
                PIN asli tidak pernah disimpan.
              </>
            ) : (
              <>
                Catatan ini dibuat sebelum pencatatan data tanpa masking ditambahkan, sehingga
                hanya salinan tersamar yang tersedia. Transaksi baru akan menyertakan request,
                endpoint, dan respons tanpa masking.
              </>
            )}
          </div>
        )}

        <div className="bg-surface rounded-surface shadow border p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs text-ink-3">Referensi</label>
              <p className="font-mono text-sm text-ink">{tx.transaction_ref}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Referensi Penyedia</label>
              <p className="font-mono text-sm text-ink">{tx.provider_reference || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Tipe</label>
              <p className="text-sm text-ink">{tx.transaction_type}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Produk</label>
              <p className="text-sm text-ink">{tx.product_name || tx.product_code || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Kode Produk</label>
              <p className="font-mono text-sm text-ink">{tx.product_code || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Tipe Produk</label>
              <p className="text-sm text-ink">{tx.product_type || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Tujuan</label>
              <p className="text-sm text-ink">{tx.destination || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Nominal</label>
              <p className="text-sm text-ink">{tx.amount ? formatIDR(tx.amount) : '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Status</label>
              <p className="text-sm text-ink">{tx.status}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Dibuat</label>
              <p className="text-sm text-ink">{formatDate(tx.created_at)}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Waktu Request</label>
              <p className="text-sm text-ink">{formatDate(tx.request_timestamp)}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Waktu Respons</label>
              <p className="text-sm text-ink">{formatDate(tx.provider_response_timestamp)}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Status HTTP</label>
              <p className="text-sm text-ink">{tx.http_status_code ?? '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Kode Error</label>
              <p className="text-sm text-ink">{tx.error_code || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Pesan Error</label>
              <p className="text-sm text-ink">{tx.error_message || '—'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-ink">
                Metadata{" "}
                {showUnmasked && tx.metadata_unmasked != null ? (
                  <span className="text-warning-strong">(tanpa masking)</span>
                ) : (
                  <span className="text-ink-4">(tersamar)</span>
                )}
              </h3>
            </div>
            {showUnmasked && tx.metadata_unmasked == null && (
              <p className="mb-2 text-xs text-ink-4">
                Data tanpa masking tidak tersedia untuk catatan ini (dibuat sebelum fitur ini ada).
              </p>
            )}
            <pre className="text-xs bg-canvas p-3 rounded-control overflow-auto max-h-64">
              {JSON.stringify(metadataDisplay, null, 2) || '{}'}
            </pre>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-ink">Request cURL</h3>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 text-xs border border-line-strong rounded-control hover:bg-canvas"
              >
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <p aria-live="polite" className="sr-only">{copied ? 'cURL disalin ke clipboard' : ''}</p>
            {curlMasked && (
              <p className="mb-2 text-xs text-ink-4">
                Data tanpa masking tidak tersedia untuk catatan ini (dibuat sebelum fitur ini ada) — body ditampilkan tersamar.
              </p>
            )}
            <pre className="text-xs bg-ink text-line p-3 rounded-control overflow-auto max-h-64">
              {curl}
            </pre>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-ink mb-2">
              Respons Mentah Penyedia{" "}
              {showUnmasked && tx.raw_response_unmasked != null ? (
                <span className="text-warning-strong">(tanpa masking)</span>
              ) : (
                <span className="text-ink-4">(tersamar)</span>
              )}
            </h3>
            {showUnmasked && tx.raw_response_unmasked == null && (
              <p className="mb-2 text-xs text-ink-4">
                Data tanpa masking tidak tersedia untuk catatan ini (dibuat sebelum fitur ini ada).
              </p>
            )}
            <pre className="text-xs bg-canvas p-3 rounded-control overflow-auto max-h-64">
              {JSON.stringify(rawDisplay, null, 2) || '{}'}
            </pre>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
