'use client';

import { DashboardShell } from '../../../../components/DashboardShell';
import { useState } from 'react';
import { api } from '../../../../lib/api';
import { StockFamily, StockTransactionInfoResponse } from '../../../../types';
import { StatusBadge } from '../../../../components/StatusBadge';

const OPERATIONS = [
  { value: 'SELLVOUCHER', label: 'Injeksi SP' },
  { value: 'PHYSICALVOUCHER', label: 'Injeksi Voucher' },
];

export default function StockTransactionInfoPage() {
  const [family, setFamily] = useState<StockFamily>('awg');
  const [servicetype, setServicetype] = useState('SELLVOUCHER');
  const [masterTrxId, setMasterTrxId] = useState('');
  const [result, setResult] = useState<StockTransactionInfoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = masterTrxId.trim();
    if (!id) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.lookupStockTransactionInfo(family, servicetype, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pencarian gagal');
    } finally {
      setLoading(false);
    }
  };

  const rows = result?.rows ?? [];

  return (
    <DashboardShell>
      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Info Transaksi</h1>
          <p className="mt-1 text-sm text-ink-3">
            Cek status transaksi stok AWG / XWG berdasarkan masterTrxId — termasuk transaksi
            yang dilakukan di luar dashboard ini.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mb-4 rounded-surface border border-line bg-surface p-6 space-y-4"
        >
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs text-ink-3">Keluarga</label>
              <div
                className="inline-flex rounded-control border border-line-strong p-0.5 text-sm"
                role="group"
                aria-label="Keluarga stok"
              >
                {(['xwg', 'awg'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFamily(value)}
                    aria-pressed={family === value}
                    className={`rounded-control px-3 py-1.5 font-medium uppercase transition-colors ${
                      family === value ? 'bg-primary text-white' : 'text-ink-2 hover:bg-line'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="operation" className="mb-1 block text-xs text-ink-3">
                Operasi
              </label>
              <select
                id="operation"
                value={servicetype}
                onChange={(e) => setServicetype(e.target.value)}
                className="w-48 rounded-control border border-line-strong px-3 py-2 text-sm focus:border-primary focus:ring-primary"
              >
                {OPERATIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 flex-1">
              <label htmlFor="master-trx-id" className="mb-1 block text-xs text-ink-3">
                masterTrxId
              </label>
              <input
                id="master-trx-id"
                type="text"
                value={masterTrxId}
                onChange={(e) => setMasterTrxId(e.target.value)}
                placeholder="mis. TEMBAK101162221212132411526"
                autoComplete="off"
                className="block w-full rounded-control border border-line-strong px-3 py-2 font-mono text-sm focus:border-primary focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !masterTrxId.trim()}
              className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Mencari…' : 'Cari'}
            </button>
          </div>
          <p className="text-xs text-ink-4">
            Pencarian hanya-baca ke API Info Transaction Detail milik penyedia. Tidak ada yang
            disimpan ke riwayat. Gunakan operasi yang sama dengan yang menghasilkan transaksi (Injeksi SP atau
            Injeksi Voucher).
          </p>
        </form>

        {error && (
          <div className="mb-4 rounded-control border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger-strong">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-surface border border-line bg-surface p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink">Hasil</h2>
                <p className="mt-0.5 break-all font-mono text-xs text-ink-3">
                  {result.master_trx_id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-line px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-3">
                  {family}
                </span>
                {rows.length > 0 && result.status ? (
                  <StatusBadge status={result.status} />
                ) : (
                  <span className="rounded-full bg-line px-2.5 py-0.5 text-xs font-medium text-ink-3">
                    Tidak ada hasil
                  </span>
                )}
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-control border border-warning-border bg-warning-subtle px-4 py-3 text-sm text-warning-strong">
                Tidak ada baris detail untuk masterTrxId ini dengan operasi yang dipilih. Periksa
                keluarga dan operasi, atau transaksi mungkin belum diproses.
              </div>
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
                    {rows.map((row, i) => (
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

            {result.raw_response && (
              <details className="mt-4 border-t border-line pt-4">
                <summary className="cursor-pointer text-sm font-medium text-ink">
                  Respons mentah penyedia
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-control bg-canvas p-3 text-xs">
                  {JSON.stringify(result.raw_response, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
