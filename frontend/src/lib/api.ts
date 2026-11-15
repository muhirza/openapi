import {
  CredentialStatus,
  CredentialListStatus,
  CredentialSaveResponse,
  TokenStatus,
  TokenRefreshResponse,
  BalanceSummary,
  BalanceResponse,
  HistoryResponse,
  ProductListResponse,
  ProductStatus,
  SyncProductResult,
  PinStatus,
  PinSaveResponse,
  BuyPulsaRequest,
  BuyDataPackageRequest,
  CocktailSFRequest,
  PackageInjectionRequest,
  TransactionResult,
  LocalTransactionListResponse,
  LocalTransactionDetail,
  SyncSettings,
  SyncRunResult,
  StockFamily,
  StockListResponse,
  StockInjectRequest,
  StockHistoryListResponse,
  StockHistoryDetail,
  StockTransactionInfoResponse,
  SessionInfo,
  AnalyticsRange,
  NonDigitalAnalyticsResponse,
  TopProductsResponse,
} from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const AUTH_PROBE_ENDPOINTS = ['/api/login', '/api/register', '/api/me'];

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const message = error.detail || `Request failed: ${res.status}`;

    if (
      res.status === 401 &&
      typeof window !== 'undefined' &&
      !AUTH_PROBE_ENDPOINTS.some((path) => endpoint.startsWith(path))
    ) {
      window.dispatchEvent(new Event('auth:expired'));
    }

    throw new ApiError(message, res.status);
  }

  return res.json();
}

export const api = {
  // ---------- Auth ----------
  register: (username: string, password: string) =>
    apiRequest<{ message: string; user_id: number }>('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    apiRequest<{ message: string; username: string; expires_at: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    apiRequest<{ message: string }>('/api/logout', { method: 'POST' }),

  me: () => apiRequest<SessionInfo>('/api/me'),

  // ---------- Credentials ----------
  // Single credential status for a specific api_name (default: get_token)
  getCredentialStatus: (apiName: string = 'get_token') =>
    apiRequest<CredentialStatus>(`/api/profile/credentials/${apiName}`),

  // All credential statuses (list) — used by the multi-credential UI
  getAllCredentialStatus: () =>
    apiRequest<CredentialListStatus>('/api/profile/credentials'),

  saveCredentials: (
    clientId: string,
    clientSecret: string,
    apiName: string = 'get_token'
  ) =>
    apiRequest<CredentialSaveResponse>(`/api/profile/credentials/${apiName}`, {
      method: 'PUT',
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    }),

  // ---------- Token ----------
  getTokenStatus: () =>
    apiRequest<TokenStatus>('/api/token/status'),

  refreshToken: () =>
    apiRequest<TokenRefreshResponse>('/api/token/refresh', { method: 'POST' }),

  // ---------- PIN (MVP2) ----------
  getPinStatus: () => apiRequest<PinStatus>('/api/profile/pin/status'),

  setPin: (pin: string) =>
    apiRequest<PinSaveResponse>('/api/profile/pin', {
      method: 'PUT',
      body: JSON.stringify({ pin }),
    }),

  // ---------- Transactions (MVP2) ----------
  buyPulsa: (payload: BuyPulsaRequest) =>
    apiRequest<TransactionResult>('/api/transactions/buy-pulsa', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  buyDataPackage: (payload: BuyDataPackageRequest) =>
    apiRequest<TransactionResult>('/api/transactions/buy-data-package', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cocktailSF: (payload: CocktailSFRequest) =>
    apiRequest<TransactionResult>('/api/transactions/cocktail-sf', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  packageInjection: (payload: PackageInjectionRequest) =>
    apiRequest<TransactionResult>('/api/transactions/package-injection', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLocalTransactions: (opts: {
    page?: number;
    perPage?: number;
    type?: string;
    status?: string;
    source?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.perPage) params.set('per_page', String(opts.perPage));
    if (opts.type) params.set('type', opts.type);
    if (opts.status) params.set('status', opts.status);
    if (opts.source) params.set('source', opts.source);
    if (opts.search) params.set('search', opts.search);
    if (opts.startDate) params.set('start_date', opts.startDate);
    if (opts.endDate) params.set('end_date', opts.endDate);
    const qs = params.toString();
    return apiRequest<LocalTransactionListResponse>(
      `/api/transactions/local${qs ? `?${qs}` : ''}`
    );
  },

  getLocalTransaction: (id: number | string) =>
    apiRequest<LocalTransactionDetail>(`/api/transactions/local/${id}`),

  downloadHistoryExcel: async (opts: {
    type?: string;
    status?: string;
    source?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (opts.type) params.set('type', opts.type);
    if (opts.status) params.set('status', opts.status);
    if (opts.source) params.set('source', opts.source);
    if (opts.search) params.set('search', opts.search);
    if (opts.startDate) params.set('start_date', opts.startDate);
    if (opts.endDate) params.set('end_date', opts.endDate);
    const qs = params.toString();

    const res = await fetch(
      `${API_URL}/api/transactions/local/export${qs ? `?${qs}` : ''}`,
      { credentials: 'include' }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || `Export failed: ${res.status}`);
    }

    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const fallback =
      opts.startDate && opts.endDate
        ? `RiwayatTransaksi_${opts.startDate}_sampai_${opts.endDate}.xlsx`
        : opts.startDate
        ? `RiwayatTransaksi_dari_${opts.startDate}.xlsx`
        : opts.endDate
        ? `RiwayatTransaksi_hingga_${opts.endDate}.xlsx`
        : `RiwayatTransaksi_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const filename = match ? match[1] : fallback;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  refreshTransaction: (id: number | string) =>
    apiRequest<TransactionResult>(`/api/transactions/local/${id}/refresh`, {
      method: 'POST',
    }),

  // ---------- Provider history auto-sync ----------
  getSyncSettings: () =>
    apiRequest<SyncSettings>('/api/profile/sync-settings'),

  updateSyncSettings: (payload: { enabled?: boolean; interval_minutes?: number }) =>
    apiRequest<SyncSettings>('/api/profile/sync-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  runSyncNow: () =>
    apiRequest<SyncRunResult>('/api/profile/sync-settings/run-now', {
      method: 'POST',
    }),

  // ---------- Balance ----------
  getBalances: () =>
    apiRequest<BalanceSummary>('/api/balance'),

  getBalance: (type: 'eload' | 'dompul' | 'pulsa') =>
    apiRequest<BalanceResponse>(`/api/balance/${type}`),

  // ---------- Analytics ----------
  getDashboardAnalytics: (range: AnalyticsRange) => {
    const params = new URLSearchParams({ range });
    return apiRequest<NonDigitalAnalyticsResponse>(
      `/api/analytics/non-digital?${params.toString()}`
    );
  },

  getTopProducts: (opts: {
    range: AnalyticsRange;
    transactionType?: string;
    brand?: string;
    limit?: number;
  }) => {
    const params = new URLSearchParams({ range: opts.range });
    if (opts.transactionType) params.set('transaction_type', opts.transactionType);
    if (opts.brand) params.set('brand', opts.brand);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    return apiRequest<TopProductsResponse>(
      `/api/analytics/non-digital/top-products?${params.toString()}`
    );
  },

  // ---------- History ----------
  getApiHistory: (days?: number, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (days != null) params.set('days', String(days));
    if (startDate) params.set('startdate', startDate);
    if (endDate) params.set('enddate', endDate);
    const qs = params.toString();
    return apiRequest<HistoryResponse>(`/api/history/api${qs ? `?${qs}` : ''}`);
  },

  // ---------- Products ----------
  getProducts: (opts: {
    active?: boolean | null;
    search?: string;
    brand?: string;
    name?: string;
    productType?: string;
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  } = {}) => {
    const params = new URLSearchParams();
    if (opts.active !== undefined && opts.active !== null)
      params.set('active', String(opts.active));
    if (opts.search) params.set('search', opts.search);
    if (opts.brand) params.set('brand', opts.brand);
    if (opts.name) params.set('name', opts.name);
    if (opts.productType) params.set('product_type', opts.productType);
    if (opts.page) params.set('page', String(opts.page));
    if (opts.perPage) params.set('per_page', String(opts.perPage));
    if (opts.sortBy) params.set('sort_by', opts.sortBy);
    if (opts.sortDir) params.set('sort_dir', opts.sortDir);
    const qs = params.toString();
    return apiRequest<ProductListResponse>(`/api/products${qs ? `?${qs}` : ''}`);
  },

  getProductStatus: () =>
    apiRequest<ProductStatus>('/api/products/status'),

  syncProducts: () =>
    apiRequest<SyncProductResult>('/api/products/sync', { method: 'POST' }),

  // ---------- Digital Stock ----------
  getStock: (family: StockFamily, roType?: string) => {
    const params = new URLSearchParams();
    if (roType) params.set('ro_type', roType);
    const qs = params.toString();
    return apiRequest<StockListResponse>(`/api/stock/${family}${qs ? `?${qs}` : ''}`);
  },

  stockInject: (payload: StockInjectRequest) =>
    apiRequest<TransactionResult>('/api/transactions/stock-inject', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ---------- Digital Stock History ----------
  getStockHistory: (
    family: StockFamily,
    opts: {
      page?: number;
      perPage?: number;
      servicetype?: string;
      status?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ) => {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.perPage) params.set('per_page', String(opts.perPage));
    if (opts.servicetype) params.set('servicetype', opts.servicetype);
    if (opts.status) params.set('status', opts.status);
    if (opts.search) params.set('search', opts.search);
    if (opts.startDate) params.set('start_date', opts.startDate);
    if (opts.endDate) params.set('end_date', opts.endDate);
    const qs = params.toString();
    return apiRequest<StockHistoryListResponse>(
      `/api/stock/${family}/history${qs ? `?${qs}` : ''}`
    );
  },

  getStockHistoryItem: (family: StockFamily, id: number | string) =>
    apiRequest<StockHistoryDetail>(`/api/stock/${family}/history/${id}`),

  refreshStockHistoryDetail: (family: StockFamily, id: number | string) =>
    apiRequest<StockHistoryDetail>(`/api/stock/${family}/history/${id}/refresh-detail`, {
      method: 'POST',
    }),

  lookupStockTransactionInfo: (
    family: StockFamily,
    servicetype: string,
    masterTrxId: string
  ) =>
    apiRequest<StockTransactionInfoResponse>(`/api/stock/${family}/transaction-info`, {
      method: 'POST',
      body: JSON.stringify({ servicetype, master_trx_id: masterTrxId }),
    }),
};