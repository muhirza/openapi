export interface User {
  id: number;
  username: string;
}

// ---------- Credentials ----------

export interface CredentialStatus {
  has_credentials: boolean;
  api_name: string;
  client_id_masked: string | null;
  saved_at: string | null;
}

export interface CredentialItemStatus {
  api_name: string;
  label: string;
  has_credentials: boolean;
  client_id_masked: string | null;
  saved_at: string | null;
}

export interface CredentialListStatus {
  items: CredentialItemStatus[];
}

export interface CredentialSaveResponse {
  message: string;
  api_name: string;
  id: number;
}

// ---------- Token ----------

export interface TokenStatus {
  has_token: boolean;
  expires_at: string | null;
  is_valid: boolean;
}

export interface TokenRefreshResponse {
  success: boolean;
  expires_at: string | null;
  error: string | null;
}

// ---------- Balance ----------

export interface BalanceResponse {
  balance_type: string;
  balance: string; // Decimal serialised as string
  currency: string;
  fetched_at: string;
}

export interface BalanceSummary {
  eload: BalanceResponse | null;
  dompul: BalanceResponse | null;
}

// ---------- History / Transactions ----------

export interface TransactionItem {
  transaction_ref: string;
  date: string;
  transaction_type: string;
  product: string | null;
  amount: string | null; // Decimal serialised as string
  status: string;
  destination: string | null;
  payment_method: string | null;
  provider_reference: string | null;
  raw: Record<string, unknown>;
}

export interface HistoryResponse {
  items: TransactionItem[];
  total: number;
  source: string;
  date_range: string;
}

// ---------- Products ----------

export interface ProductOut {
  id: number;
  product_code: string;
  product_name: string | null;
  product_type: string | null;
  owner: string | null;
  price: string | null; // Decimal serialised as string
  active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductListResponse {
  products: ProductOut[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  active_count: number;
  inactive_count: number;
  brands: string[];
  product_types: string[];
}

export interface ProductStatus {
  last_synced_at: string | null;
  active_count: number;
  inactive_count: number;
  total: number;
}

export interface SyncProductResult {
  success: boolean;
  inserted: number;
  updated: number;
  deactivated: number;
  total_active: number;
  synced_at: string | null;
  error: string | null;
}

// ---------- PIN ----------

export interface PinStatus {
  has_pin: boolean;
}

export interface PinSaveResponse {
  message: string;
  id: number;
}

// ---------- Transactions (MVP2) ----------

export type TransactionStatus = 'SUCCESS' | 'FAILED' | 'PROCESSING';

export interface BuyPulsaRequest {
  msisdn: string;
  denom: number;
}

export interface BuyDataPackageRequest {
  msisdn: string;
  product_code: string;
}

export interface CocktailSFRequest {
  product_code: string;
  targets: string[];
}

export interface PackageInjectionRequest {
  msisdn: string;
  product_code: string;
}

export interface TransactionResult {
  transaction_ref: string;
  transaction_type: string;
  status: TransactionStatus;
  provider_reference: string | null;
  message: string | null;
  amount: string | null;
  destination: string | null;
  created_at: string | null;
}

export interface LocalTransactionOut {
  id: number;
  transaction_ref: string;
  transaction_type: string;
  product_code: string | null;
  product_name: string | null;
  product_type: string | null;
  amount: string | null;
  status: string;
  provider_reference: string | null;
  source: 'app' | 'synced' | string;
  destination: string | null;
  payment_method: string | null;
  request_timestamp: string | null;
  provider_response_timestamp: string | null;
  http_status_code: number | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LocalTransactionDetail extends LocalTransactionOut {
  raw_response: Record<string, unknown> | null;
  raw_response_unmasked?: Record<string, unknown> | null;
  metadata_unmasked?: Record<string, unknown> | null;
}

export interface LocalTransactionSummary {
  total: number;
  success: number;
  failed: number;
  processing: number;
  success_amount: string;
}

export interface LocalTransactionListResponse {
  items: LocalTransactionOut[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  summary: LocalTransactionSummary | null;
}

// ---------- Provider history auto-sync ----------

export interface SyncSettings {
  enabled: boolean;
  interval_minutes: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_count: number | null;
  next_sync_at: string | null;
}

export interface SyncRunResult {
  added: number;
  synced_at: string;
}

// ---------- Digital Stock ----------

export type StockFamily = 'awg' | 'xwg';

export interface StockItem {
  voucher_type_code: string;
  description: string | null;
  voucher_price: string | null;
  voucher_balance: number;
  effective_date: string | null;
  expiration_date: string | null;
  voucher_exp_date: string | null;
  allow_type: string | null;
  voucher_id: string | null;
}

export interface StockListResponse {
  family: string;
  items: StockItem[];
  total: number;
  stock_value: string;
  total_vouchers: number;
  ro_type: string | null;
  fetched_at: string;
}

export interface StockInjectRequest {
  family: StockFamily;
  targets: string[];
  voucher_id: string;
  allow_type: string;
  voucher_type_code: string;
  description?: string | null;
  price?: string | null;
}

export type StockServiceType =
  | 'SELLVOUCHER'
  | 'PHYSICALVOUCHER'
  | 'TRANSFER'
  | 'BUYSTOCK'
  | 'EXTENDSTOCK'
  | 'TRFBALANCE'
  | 'TEMBAKSTOK';

// ---------- Digital Stock History ----------

export interface StockHistoryItem {
  id: number;
  family: StockFamily | string;
  servicetype: StockServiceType | string;
  master_trx_id: string;
  type: string | null;
  status: string;
  status_raw: string | null;
  description: string | null;
  voucher_price: string | null;
  price_normal: string | null;
  voucher_type_code: string | null;
  source_msisdn: string | null;
  destination_msisdn: string | null;
  created_dtm: string | null;
  synced_at: string | null;
  detail_status: string | null;
  detail_fetched_at: string | null;
}

export interface StockHistoryDetailRow {
  bMsisdn: string | null;
  status: string | null;
  statusDetail: string | null;
}

export interface StockHistoryDetail extends StockHistoryItem {
  detail: StockHistoryDetailRow[] | null;
  raw_response: Record<string, unknown> | null;
  raw_response_unmasked?: Record<string, unknown> | null;
}

export interface StockHistorySummary {
  total: number;
  success: number;
  failed: number;
  processing: number;
}

export interface StockHistoryListResponse {
  items: StockHistoryItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  summary: StockHistorySummary | null;
}

export interface StockTransactionInfoResponse {
  family: StockFamily | string;
  servicetype: StockServiceType | string;
  master_trx_id: string;
  status: string | null;
  rows: StockHistoryDetailRow[];
  raw_response: Record<string, unknown> | null;
}

// ---------- Auth ----------

export interface SessionInfo {
  username: string;
  idle_expires_at: string;
  session_expires_at: string;
}

// ---------- Analytics ----------

export type AnalyticsRange = '7d' | '30d' | '90d' | 'month';

export interface AnalyticsWindow {
  key: AnalyticsRange;
  start: string;
  end: string;
  elapsed_days: number;
}

export interface NonDigitalKpis {
  total: number;
  success: number;
  failed: number;
  processing: number;
  transaction_amount: string; // Decimal serialised as string
  successful_with_amount: number;
  average_successful_amount: string | null;
  success_rate: string | null; // 0-1 fraction
  error_rate: string | null; // 0-1 fraction
  transactions_per_day: string;
}

export interface DailyPoint {
  date: string;
  total: number;
  success: number;
  failed: number;
  processing: number;
  transaction_amount: string;
}

export interface MonthlyMdaPoint {
  month: string;
  elapsed_days: number;
  is_current_month: boolean;
  transaction_count: number;
  transaction_amount: string;
  transactions_per_day: string;
  amount_per_day: string;
}

export interface NonDigitalMda {
  current: MonthlyMdaPoint;
  previous: MonthlyMdaPoint | null;
  months: MonthlyMdaPoint[];
}

export interface BrandBreakdown {
  brand: string;
  transaction_count: number;
  transaction_amount: string;
}

export interface BrandPerformance extends BrandBreakdown {
  count_share: string; // 0-1 fraction
  amount_share: string; // 0-1 fraction
}

export interface TransactionTypePerformance {
  transaction_type: string;
  transaction_count: number;
  transaction_amount: string;
  brands: BrandBreakdown[];
}

export interface TopProduct {
  transaction_type: string;
  product_code: string | null;
  product_name: string | null;
  display_name: string;
  brand: string;
  transaction_count: number;
  transaction_amount: string;
}

export interface TopProductsResponse {
  range: AnalyticsWindow;
  transaction_type: string | null;
  brand: string | null;
  items: TopProduct[];
}

export interface NonDigitalAnalyticsResponse {
  range: AnalyticsWindow;
  kpis: NonDigitalKpis;
  daily: DailyPoint[];
  mda: NonDigitalMda;
  brands: BrandPerformance[];
  transaction_types: TransactionTypePerformance[];
}