'use client';

import { DashboardShell } from '../../../../../../components/DashboardShell';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { StockFamily, StockHistoryDetail } from '../../../../../../types';
import { StatusBadge } from '../../../../../../components/StatusBadge';
import { formatIDR, formatDate, formatDateOnly } from '../../../../../../lib/format';

const SERVICE_LABELS: Record<string, string> = {
  SELLVOUCHER: 'Injeksi SP',
  PHYSICALVOUCHER: 'Injeksi Voucher',
  TRANSFER: 'Terima Transfer Stok',
  BUYSTOCK: 'Beli Stok (Mini Grosir)',
  EXTENDSTOCK: 'Perpanjang Stok WG',
  TRFBALANCE: 'Transfer Saldo ke Parent',
  TEMBAKSTOK: 'Injeksi Stok Parent',
};

export default function StockHistoryDetailPage() {
  const params = useParams();
  const family = (params.family as StockFamily) || 'awg';
  const id = params.id as string;

  const [tx, setTx] = useState<StockHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showUnmasked, setShowUnmasked] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setTx(await api.getStockHistoryItem(family, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat transaksi stok');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, id]);

  const handleFetchDetail = async () => {
    setRefreshing(true);
    setError('');
    try {
      setTx(await api.refreshStockHistoryDetail(family, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memeriksa status');
    } finally {
      setRefreshing(false);
    }
  };

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
        <div className="text-center py-8 text-danger">{error || 'Transaksi stok tidak ditemukan'}</div>
      </DashboardShell>
    );
  }

  const rawDisplay =
    showUnmasked && tx.raw_response_unmasked != null
      ? tx.raw_response_unmasked
      : tx.raw_response;
  const hasUnmasked = tx.raw_response_unmasked != null;
  const detailRows = tx.detail ?? [];

  return (
    <DashboardShell>
      <div>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">Detail Transaksi Stok</h1>
            <p className="mt-1 font-mono text-sm text-ink-3">{tx.master_trx_id}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={tx.status} />
            <button
              onClick={handleFetchDetail}
              disabled={refreshing}
              className="px-3 py-1.5 text-sm border border-line-strong rounded-control hover:bg-canvas disabled:opacity-50"
            >
              {refreshing ? 'Memeriksa...' : 'Periksa Status'}
            </button>
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
            {hasUnmasked
              ? 'Tampilan tanpa masking — menampilkan respons persis seperti yang diterima dari penyedia.'
              : 'Tidak ada respons tanpa masking yang tersimpan untuk catatan ini; menampilkan salinan tersamar.'}
          </div>
        )}

        <div className="bg-surface rounded-surface shadow border p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-xs text-ink-3">Keluarga</label>
              <p className="text-sm font-medium uppercase text-ink">{tx.family}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Operasi</label>
              <p className="text-sm text-ink">
                {SERVICE_LABELS[tx.servicetype] ?? tx.servicetype}
              </p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Tipe Penyedia</label>
              <p className="font-mono text-sm text-ink">{tx.type || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Kode Voucher</label>
              <p className="font-mono text-sm text-ink">{tx.voucher_type_code || '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-ink-3">Deskripsi</label>
              <p className="text-sm text-ink">{tx.description || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Harga Voucher</label>
              <p className="text-sm font-semibold text-ink">
                {tx.voucher_price ? formatIDR(tx.voucher_price) : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Harga Normal</label>
              <p className="text-sm text-ink">
                {tx.price_normal ? formatIDR(tx.price_normal) : '—'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">MSISDN Sumber</label>
              <p className="text-sm text-ink tabular-nums">{tx.source_msisdn || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">MSISDN Tujuan</label>
              <p className="text-sm text-ink tabular-nums">{tx.destination_msisdn || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Tanggal Transaksi</label>
              <p className="text-sm text-ink">{formatDateOnly(tx.created_dtm)}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Status Detail</label>
              <p className="text-sm text-ink">{tx.detail_status || '—'}</p>
            </div>
            <div>
              <label className="block text-xs text-ink-3">Detail Diambil</label>
              <p className="text-sm text-ink">{formatDate(tx.detail_fetched_at)}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">
                Detail per Tujuan{' '}
                <span className="text-ink-4">
                  ({detailRows.length} baris)
                </span>
              </h3>
            </div>
            {detailRows.length === 0 ? (
              <p className="text-xs text-ink-4">
                {tx.detail_fetched_at
                  ? 'Penyedia tidak mengembalikan baris per tujuan untuk transaksi ini.'
                  : 'Pemeriksaan status belum dijalankan. Gunakan “Periksa Status” untuk melihat hasil per tujuan dari penyedia.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-2xs font-semibold uppercase tracking-wider text-ink-3">
                      <th className="pb-2 pr-4">MSISDN Tujuan</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Detail Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {detailRows.map((row, i) => (
                      <tr key={`${row.bMsisdn ?? 'row'}-${i}`}>
                        <td className="py-2 pr-4 font-mono text-xs text-ink tabular-nums">
                          {row.bMsisdn || '—'}
                        </td>
                        <td className="py-2 pr-4">
                          {row.status ? (
                            <StatusBadge status={row.status} />
                          ) : (
                            <span className="text-xs text-ink-4">—</span>
                          )}
                        </td>
                        <td className="py-2 text-xs text-ink-2">{row.statusDetail || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-ink mb-2">
              Respons Mentah Penyedia{' '}
              {showUnmasked && tx.raw_response_unmasked != null ? (
                <span className="text-warning-strong">(tanpa masking)</span>
              ) : (
                <span className="text-ink-4">(tersamar)</span>
              )}
            </h3>
            <pre className="text-xs bg-canvas p-3 rounded-control overflow-auto max-h-64">
              {JSON.stringify(rawDisplay, null, 2) || '{}'}
            </pre>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
