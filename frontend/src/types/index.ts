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
  pulsa: BalanceResponse | null;
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
}

export interface LocalTransactionListResponse {
  items: LocalTransactionOut[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ---------- Auth ----------

export interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  loading: boolean;
}