'use client';

export function StatusBadge({ status }: { status: string }) {
  const raw = status?.toLowerCase?.() ?? '';
  const s = raw.toUpperCase();

  let label = s;
  let cls = 'bg-line text-ink-2';
  let dotCls = 'bg-ink-4';

  // Normalize common provider statuses
  if (raw === 'success' || raw === 'sukses') {
    label = 'Success';
    cls = 'bg-success-subtle text-success-strong';
    dotCls = 'bg-success';
  } else if (raw === 'failed' || raw === 'error') {
    label = 'Failed';
    cls = 'bg-danger-subtle text-danger-strong';
    dotCls = 'bg-danger';
  } else if (raw === 'processing') {
    label = 'Processing';
    cls = 'bg-primary-subtle text-primary-hover';
    dotCls = 'bg-primary';
  } else if (raw === 'businesserror') {
    label = 'Business Error';
    cls = 'bg-warning-subtle text-warning-strong';
    dotCls = 'bg-warning';
  } else if (raw === 'systemerror') {
    label = 'System Error';
    cls = 'bg-danger-subtle text-danger-strong';
    dotCls = 'bg-danger';
  } else if (raw === 'refund') {
    label = 'Refund';
    cls = 'bg-line text-ink-2';
    dotCls = 'bg-ink-3';
  } else if (s === 'SUCCESS') {
    label = 'Success';
    cls = 'bg-success-subtle text-success-strong';
    dotCls = 'bg-success';
  } else if (s === 'FAILED') {
    label = 'Failed';
    cls = 'bg-danger-subtle text-danger-strong';
    dotCls = 'bg-danger';
  } else if (s === 'PROCESSING') {
    label = 'Processing';
    cls = 'bg-primary-subtle text-primary-hover';
    dotCls = 'bg-primary';
  } else if (s) {
    // Title-case fallback for unknown statuses
    label = s.charAt(0) + s.slice(1).toLowerCase();
    cls = 'bg-line text-ink-2';
    dotCls = 'bg-ink-4';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
      {label}
    </span>
  );
}
