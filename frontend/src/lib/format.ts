/** Format a decimal string as IDR currency (Rp 1.234,56) */
export function formatIDR(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/** English month abbreviations for deterministic formatting */
const EN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format ISO date string to deterministic "4 Oct 2026, 21:00" (English month, 24h) */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = EN_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hour}:${minute}`;
  } catch {
    return dateStr;
  }
}

/** Format just the date part: "4 Oct 2026" */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = EN_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

/** Format just the time part, 24h: "23:39" */
export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    return `${hour}:${minute}`;
  } catch {
    return '';
  }
}

/** Short relative time (e.g., "2 days ago") */
export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    return 'Just now';
  } catch {
    return dateStr;
  }
}

/** Status badge class for active/inactive */
export function activeBadgeClass(active: boolean): string {
  return active
    ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
    : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800';
}

/** Parse a decimal string/number defensively. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/** Format a number with Indonesian grouping, e.g. 18250 -> "18.250". */
export function formatNumber(
  value: string | number | null | undefined,
  digits = 0
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

/** Format a 0-1 rate as a percentage, e.g. 0.9524 -> "95.2%". */
export function formatRate(
  value: string | number | null | undefined,
  digits = 1
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  return `${(num * 100).toFixed(digits)}%`;
}

/** Get the short month from an ISO date without timezone shifts. */
export function formatMonthShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length < 2) return '—';
  const monthIndex = Number(parts[1]) - 1;
  return EN_MONTHS[monthIndex] ?? '—';
}

/** Get "8 Nov" from an ISO date without timezone shifts. */
export function formatDayMonth(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const monthIndex = Number(parts[1]) - 1;
  return `${Number(parts[2])} ${EN_MONTHS[monthIndex] ?? ''}`.trim();
}

/** Compact rupiah for chart axes, e.g. 18250 -> "18k", 1500000 -> "1.5jt". */
export function formatCompactIDR(
  value: string | number | null | undefined
): string {
  const num = toNumber(value);
  const absolute = Math.abs(num);

  if (absolute >= 1_000_000) {
    const millions = num / 1_000_000;
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}jt`;
  }
  if (absolute >= 1_000) {
    return `${Math.round(num / 1_000)}k`;
  }
  return String(num);
}