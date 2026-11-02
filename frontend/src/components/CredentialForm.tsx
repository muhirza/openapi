'use client';

import { ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { CredentialItemStatus, PinStatus } from '../types';
import {
  IconAlertCircle,
  IconCheck,
  IconCheckCircle,
  IconChevronDown,
  IconCoins,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLayers,
  IconLightning,
  IconLock,
  IconPackage,
  IconSearch,
  IconSettings,
  IconShieldCheck,
} from './icons';

type IconComponent = ComponentType<{ size?: number }>;

interface CredentialGroupDef {
  title: string;
  description: string;
  icon: IconComponent;
  apiNames: string[];
}

const GROUPS: CredentialGroupDef[] = [
  {
    title: 'Authentication',
    description: 'Token issuance and transaction signing.',
    icon: IconKey,
    apiNames: ['get_token', 'encrypt_pin'],
  },
  {
    title: 'Balances',
    description: 'Deposit balance lookups.',
    icon: IconCoins,
    apiNames: ['balance_eload', 'balance_dompul'],
  },
  {
    title: 'Products & history',
    description: 'Product catalog and transaction reporting.',
    icon: IconPackage,
    apiNames: ['product_list', 'history_api', 'history_detail'],
  },
  {
    title: 'Transactions',
    description: 'Order endpoints for each product line.',
    icon: IconLightning,
    apiNames: ['buy_pulsa', 'buy_data_package', 'cocktail_sf', 'package_injection'],
  },
  {
    title: 'Digital Stock',
    description: 'Stock lists, voucher injection, and transaction lookups for AWG and XWG.',
    icon: IconLayers,
    apiNames: [
      'awg',
      'xwg',
      'awg_stock_inject',
      'xwg_stock_inject',
      'awg_transaction_info_detail',
      'xwg_transaction_info_detail',
    ],
  },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'configured', label: 'Configured' },
  { key: 'missing', label: 'Needs setup' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function formatSaved(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusChip({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-2xs font-semibold text-success-strong">
        <IconCheck size={11} aria-hidden="true" />
        Configured
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-subtle px-2 py-0.5 text-2xs font-semibold text-warning-strong">
      <IconAlertCircle size={11} aria-hidden="true" />
      Not set
    </span>
  );
}

function SectionHeading({ group }: { group: CredentialGroupDef & { items: CredentialItemStatus[] } }) {
  const configured = group.items.filter((item) => item.has_credentials).length;
  const headingId = `group-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const GroupIcon = group.icon;
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-control bg-surface-muted text-ink-3">
        <GroupIcon size={14} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 id={headingId} className="text-sm font-semibold text-ink">
            {group.title}
          </h2>
          <span className="text-2xs font-medium text-ink-4">
            {configured}/{group.items.length}
          </span>
        </div>
        <p className="text-2xs text-ink-3">{group.description}</p>
      </div>
    </div>
  );
}

interface CredentialCardProps {
  item: CredentialItemStatus;
  icon: IconComponent;
  onSaved: (apiName: string) => void;
}

function CredentialCard({ item, icon: CardIcon, onSaved }: CredentialCardProps) {
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [errors, setErrors] = useState<{ id?: string; secret?: string }>({});
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const formId = `cred-${item.api_name}`;
  const panelId = `${formId}-panel`;

  useEffect(() => {
    if (expanded) firstFieldRef.current?.focus();
  }, [expanded]);

  const resetForm = () => {
    setClientId('');
    setSecret('');
    setShowSecret(false);
    setErrors({});
    setFormError('');
  };

  const close = () => {
    setExpanded(false);
    setMessage('');
    resetForm();
  };

  const toggle = () => {
    if (expanded) {
      close();
      return;
    }
    setMessage('');
    resetForm();
    setExpanded(true);
  };

  const validate = () => {
    const next: { id?: string; secret?: string } = {};
    if (!clientId.trim()) next.id = 'Enter the API ID issued by your provider.';
    if (!secret.trim()) next.secret = 'Enter the API secret issued by your provider.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setFormError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await api.saveCredentials(clientId.trim(), secret.trim(), item.api_name);
      setMessage('Credentials saved');
      resetForm();
      onSaved(item.api_name);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`relative flex flex-col rounded-surface border bg-surface transition-colors ${
        expanded
          ? 'border-primary-border ring-1 ring-primary/10 md:col-span-2'
          : item.has_credentials
            ? 'border-line hover:border-line-strong'
            : 'border-dashed border-line-strong bg-canvas/60 hover:border-primary-border'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control border ${
            item.has_credentials
              ? 'border-primary-border bg-primary-subtle text-primary-hover'
              : 'border-line bg-canvas text-ink-4'
          }`}
          aria-hidden="true"
        >
          <CardIcon size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{item.label}</h3>
            <StatusChip configured={item.has_credentials} />
          </div>
          {item.has_credentials ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-3">
              <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-ink-2">
                {item.client_id_masked}
              </span>
              {item.saved_at && (
                <>
                  <span aria-hidden="true">•</span>
                  <span>Updated {formatSaved(item.saved_at)}</span>
                </>
              )}
            </div>
          ) : (
            <p className="mt-1.5 text-2xs text-ink-3">Add credentials to enable this service.</p>
          )}
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            expanded
              ? 'border-line bg-surface text-ink-2 hover:bg-canvas'
              : item.has_credentials
                ? 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
                : 'border-primary bg-primary text-white hover:bg-primary-hover'
          }`}
        >
          {expanded ? 'Cancel' : item.has_credentials ? 'Update' : 'Set up'}
          <IconChevronDown
            size={14}
            aria-hidden="true"
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="border-t border-line px-4 pb-4 pt-4 sm:px-5">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {message && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-control border border-success-border bg-success-subtle px-3 py-2 text-sm text-success-strong"
              >
                <IconCheckCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{message}</span>
              </div>
            )}
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-control border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-strong"
              >
                <IconAlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`${formId}-id`}
                  className="mb-1.5 block text-xs font-semibold text-ink-2"
                >
                  API ID
                </label>
                <input
                  id={`${formId}-id`}
                  ref={firstFieldRef}
                  type="text"
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    if (errors.id) setErrors((prev) => ({ ...prev, id: undefined }));
                  }}
                  onBlur={() => {
                    if (!clientId.trim()) {
                      setErrors((prev) => ({
                        ...prev,
                        id: 'Enter the API ID issued by your provider.',
                      }));
                    }
                  }}
                  autoComplete="off"
                  placeholder="Enter the API ID"
                  aria-invalid={Boolean(errors.id)}
                  aria-describedby={errors.id ? `${formId}-id-error` : undefined}
                  className={`block w-full rounded-control border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 ${
                    errors.id
                      ? 'border-danger focus:border-danger focus:ring-danger/20'
                      : 'border-line-strong focus:border-primary focus:ring-primary/20'
                  }`}
                />
                {errors.id && (
                  <p id={`${formId}-id-error`} className="mt-1.5 text-2xs text-danger-strong">
                    {errors.id}
                  </p>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <label
                    htmlFor={`${formId}-secret`}
                    className="block text-xs font-semibold text-ink-2"
                  >
                    API Secret
                  </label>
                  <span className="text-2xs text-ink-4">Never shown after saving</span>
                </div>
                <div className="relative">
                  <input
                    id={`${formId}-secret`}
                    type={showSecret ? 'text' : 'password'}
                    value={secret}
                    onChange={(event) => {
                      setSecret(event.target.value);
                      if (errors.secret) setErrors((prev) => ({ ...prev, secret: undefined }));
                    }}
                    onBlur={() => {
                      if (!secret.trim()) {
                        setErrors((prev) => ({
                          ...prev,
                          secret: 'Enter the API secret issued by your provider.',
                        }));
                      }
                    }}
                    autoComplete="new-password"
                    placeholder="Enter the API secret"
                    aria-invalid={Boolean(errors.secret)}
                    aria-describedby={errors.secret ? `${formId}-secret-error` : undefined}
                    className={`block w-full rounded-control border bg-surface py-2 pl-3 pr-10 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 ${
                      errors.secret
                        ? 'border-danger focus:border-danger focus:ring-danger/20'
                        : 'border-line-strong focus:border-primary focus:ring-primary/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((value) => !value)}
                    aria-label={showSecret ? 'Hide API secret' : 'Show API secret'}
                    aria-pressed={showSecret}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-control text-ink-4 transition-colors hover:text-ink-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {showSecret ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
                {errors.secret && (
                  <p id={`${formId}-secret-error`} className="mt-1.5 text-2xs text-danger-strong">
                    {errors.secret}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-1.5 text-2xs text-ink-3">
                <IconShieldCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-4" />
                Credentials are encrypted at rest and are never returned by the API.
              </p>
              <div className="flex items-center gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex flex-1 items-center justify-center rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                >
                  {loading && (
                    <span
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden="true"
                    />
                  )}
                  {loading ? 'Saving...' : 'Save credentials'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PinCard() {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res: PinStatus = await api.getPinStatus();
        setHasPin(res.has_pin);
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    if (expanded) fieldRef.current?.focus();
  }, [expanded]);

  const close = () => {
    setExpanded(false);
    setPin('');
    setShowPin(false);
    setFieldError('');
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!pin.trim()) {
      setFieldError('Enter your transaction PIN.');
      return;
    }
    setFieldError('');
    setLoading(true);
    try {
      await api.setPin(pin);
      setMessage('PIN saved');
      setPin('');
      setShowPin(false);
      setHasPin(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save PIN');
    } finally {
      setLoading(false);
    }
  };

  const panelId = 'transaction-pin-panel';

  return (
    <section className="mt-6 overflow-hidden rounded-surface border border-primary-border bg-surface">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary text-white">
          <IconLock size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">Transaction PIN</h2>
            <StatusChip configured={hasPin} />
          </div>
          <p className="mt-1 text-xs text-ink-3">
            A single static PIN signs every transaction. Stored encrypted — it is never returned.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (expanded ? close() : (setMessage(''), setExpanded(true)))}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            expanded
              ? 'border-line bg-surface text-ink-2 hover:bg-canvas'
              : hasPin
                ? 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
                : 'border-primary bg-primary text-white hover:bg-primary-hover'
          }`}
        >
          {expanded ? 'Cancel' : hasPin ? 'Change PIN' : 'Set PIN'}
          <IconChevronDown
            size={14}
            aria-hidden="true"
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="border-t border-line px-4 pb-4 pt-4 sm:px-5">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {message && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-control border border-success-border bg-success-subtle px-3 py-2 text-sm text-success-strong"
              >
                <IconCheckCircle size={16} aria-hidden="true" className="shrink-0" />
                <span>{message}</span>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-control border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-strong"
              >
                <IconAlertCircle size={16} aria-hidden="true" className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="max-w-sm">
              <label htmlFor="pin-input" className="mb-1.5 block text-xs font-semibold text-ink-2">
                Transaction PIN
              </label>
              <div className="relative">
                <input
                  id="pin-input"
                  ref={fieldRef}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value);
                    if (fieldError) setFieldError('');
                  }}
                  required
                  autoComplete="new-password"
                  placeholder="Enter transaction PIN"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? 'pin-input-error' : undefined}
                  className={`block w-full rounded-control border bg-surface py-2 pl-3 pr-10 text-sm tracking-widest text-ink placeholder:tracking-normal placeholder:text-ink-4 focus:outline-none focus:ring-2 ${
                    fieldError
                      ? 'border-danger focus:border-danger focus:ring-danger/20'
                      : 'border-line-strong focus:border-primary focus:ring-primary/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((value) => !value)}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  aria-pressed={showPin}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-control text-ink-4 transition-colors hover:text-ink-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {showPin ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
              {fieldError && (
                <p id="pin-input-error" className="mt-1.5 text-2xs text-danger-strong">
                  {fieldError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="inline-flex items-center justify-center rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && (
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden="true"
                  />
                )}
                {loading ? 'Saving...' : 'Save PIN'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export function CredentialForm() {
  const [items, setItems] = useState<CredentialItemStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = async (silent = false) => {
    setError('');
    if (!silent) setLoading(true);
    try {
      const data = await api.getAllCredentialStatus();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const configuredCount = items.filter((item) => item.has_credentials).length;
  const missingCount = items.length - configuredCount;
  const percent = items.length > 0 ? Math.round((configuredCount / items.length) * 100) : 0;

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'configured' && !item.has_credentials) return false;
      if (filter === 'missing' && item.has_credentials) return false;
      if (!needle) return true;
      return (
        item.label.toLowerCase().includes(needle) || item.api_name.toLowerCase().includes(needle)
      );
    });
  }, [items, filter, query]);

  const groups = useMemo(() => {
    const result = GROUPS.map((group) => ({ ...group, items: [] as CredentialItemStatus[] }));
    const index = new Map<string, (typeof result)[number]>();
    result.forEach((group) => group.apiNames.forEach((name) => index.set(name, group)));

    const extras: CredentialItemStatus[] = [];
    visibleItems.forEach((item) => {
      const group = index.get(item.api_name);
      if (group) group.items.push(item);
      else extras.push(item);
    });

    if (extras.length > 0) {
      result.push({
        title: 'Other',
        description: 'Additional provider integrations.',
        icon: IconSettings,
        apiNames: [],
        items: extras,
      });
    }

    return result.filter((group) => group.items.length > 0);
  }, [visibleItems]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading API configuration">
        <div className="h-32 animate-pulse rounded-surface border border-line bg-surface" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-surface border border-line bg-surface"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="rounded-surface border border-danger-border bg-danger-subtle px-5 py-6">
        <div className="flex items-start gap-2 text-sm text-danger-strong">
          <IconAlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Could not load credentials</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="mt-4 inline-flex items-center justify-center rounded-control border border-danger-border bg-surface px-3 py-2 text-sm font-semibold text-danger-strong transition-colors hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <section className="rounded-surface border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-4">Readiness</p>
            <p className="mt-1.5 text-xl font-bold tracking-tight text-ink">
              {configuredCount} of {items.length}{' '}
              <span className="text-sm font-medium text-ink-3">APIs configured</span>
            </p>
            <p className="mt-1 text-sm text-ink-3">
              {missingCount === 0
                ? 'Every service has credentials and is ready to use.'
                : `${missingCount} service${missingCount === 1 ? '' : 's'} still ${
                    missingCount === 1 ? 'needs' : 'need'
                  } credentials before ${missingCount === 1 ? 'it' : 'they'} can be used.`}
            </p>
          </div>

          <div className="w-full sm:w-64 sm:shrink-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-2">Configuration</span>
              <span className="font-semibold text-ink">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Configuration progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percent === 100 ? 'bg-success' : 'bg-primary'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-2xs text-ink-3">
              {configuredCount} configured · {missingCount} not set
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-4"
              aria-hidden="true"
            >
              <IconSearch size={16} />
            </span>
            <label htmlFor="credential-search" className="sr-only">
              Search APIs
            </label>
            <input
              id="credential-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search APIs"
              className="w-full rounded-control border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by configuration status"
            className="inline-flex w-full rounded-control border border-line bg-canvas p-1 sm:w-auto"
          >
            {FILTERS.map((option) => {
              const active = filter === option.key;
              const count =
                option.key === 'all'
                  ? items.length
                  : option.key === 'configured'
                    ? configuredCount
                    : missingCount;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  aria-pressed={active}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-none ${
                    active
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-3 hover:bg-surface/60 hover:text-ink-2'
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-1.5 text-2xs ${
                      active ? 'bg-surface-muted text-ink-2' : 'bg-line text-ink-3'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <PinCard />

      {error && items.length > 0 && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-control border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger-strong"
        >
          <IconAlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {visibleItems.length} API{visibleItems.length === 1 ? '' : 's'} shown
      </p>

      {visibleItems.length === 0 && items.length === 0 ? (
        <div className="mt-6 rounded-surface border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <IconSettings size={24} aria-hidden="true" className="mx-auto text-ink-4" />
          <p className="mt-3 text-sm font-medium text-ink">No credential types found</p>
          <p className="mt-1 text-xs text-ink-3">
            The server did not return any API integrations to configure.
          </p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-4 inline-flex items-center justify-center rounded-control border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Refresh
          </button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="mt-6 rounded-surface border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <IconSearch size={24} aria-hidden="true" className="mx-auto text-ink-4" />
          <p className="mt-3 text-sm font-medium text-ink">No APIs match your filters</p>
          <p className="mt-1 text-xs text-ink-3">Try a different search term or show all APIs.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
            className="mt-4 inline-flex items-center justify-center rounded-control border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.title} aria-labelledby={`group-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
              <SectionHeading group={group} />
              <div className="grid items-start gap-3 md:grid-cols-2">
                {group.items.map((item) => (
                  <CredentialCard
                    key={item.api_name}
                    item={item}
                    icon={group.icon}
                    onSaved={() => load(true)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
