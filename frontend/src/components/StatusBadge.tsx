'use client';

export function StatusBadge({ status }: { status: string }) {
  const raw = status?.toLowerCase?.() ?? '';
  const s = raw.toUpperCase();

  let label = s;
  let cls = 'bg-gray-100 text-gray-600';

  // Normalize common provider statuses
  if (raw === 'success' || raw === 'sukses') {
    label = 'Success';
    cls = 'bg-green-100 text-green-800';
  } else if (raw === 'failed' || raw === 'error') {
    label = 'Failed';
    cls = 'bg-red-100 text-red-800';
  } else if (raw === 'processing') {
    label = 'Processing';
    cls = 'bg-blue-100 text-blue-800';
  } else if (raw === 'businesserror') {
    label = 'Business Error';
    cls = 'bg-amber-100 text-amber-800';
  } else if (raw === 'systemerror') {
    label = 'System Error';
    cls = 'bg-red-100 text-red-800';
  } else if (s === 'SUCCESS') {
    label = 'Success';
    cls = 'bg-green-100 text-green-800';
  } else if (s === 'FAILED') {
    label = 'Failed';
    cls = 'bg-red-100 text-red-800';
  } else if (s === 'PROCESSING') {
    label = 'Processing';
    cls = 'bg-blue-100 text-blue-800';
  } else if (s) {
    // Title-case fallback for unknown statuses
    label = s.charAt(0) + s.slice(1).toLowerCase();
    cls = 'bg-gray-100 text-gray-700';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
