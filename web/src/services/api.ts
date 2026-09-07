import axios, { AxiosError } from 'axios';
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  User,
  DashboardData,
  FMIResponse,
  FMIRecord,
  Transaction,
  Liability,
  Asset,
  IncomeRecord,
  AlertItem,
  PredictabilitySnapshot,
  TransactionPayload,
  ClassifierSuggestion,
  IncomePayload,
  IncomeFlowResponse,
  LiabilityPayload,
  LiabilityTransactionsResponse,
  LiabilitiesPaymentSummaryItem,
  BehaviorResponse,
  Goal,
  ScenarioOverrides,
  WeeklyReport,
  MonthlyReport,
  PacingReport,
  HeatmapPoint,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * ============================================================================
 * AUTHENTICATION STORAGE STRATEGY (PART 2 SPECIFICATION)
 * ============================================================================
 * For this development/academic stage:
 * - Access token is stored in `sessionStorage` (15m validity)
 * - Refresh token is stored in `sessionStorage` (7d validity)
 * - User session survives page refreshes within the same browser tab
 * - Closing the browser tab/session terminates the session
 * - Tokens are NEVER stored in persistent `localStorage`
 *
 * NOTE FOR PRODUCTION HARDENING:
 * In a production deployment, web refresh tokens should preferably be migrated
 * to secure, HTTP-only, SameSite=Strict cookies to eliminate XSS token theft
 * entirely. For this phase, sessionStorage maintains exact parity with the
 * existing Express API contract and mobile client without backend disruptions.
 * ============================================================================
 */
const ACCESS_TOKEN_KEY = 'finaura_web_access_token';
const REFRESH_TOKEN_KEY = 'finaura_web_refresh_token';

export const tokenStorage = {
  getAccessToken: (): string | null => sessionStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => sessionStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string): void => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clearTokens: (): void => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export function setAuthToken(token?: string | null): void {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

// Request Interceptor: inject Bearer token from sessionStorage
api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: 401 TOKEN_EXPIRED handling with single refresh queue
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as any;

    // Do not attempt token refresh for public authentication endpoints
    const isAuthEndpoint = originalRequest?.url?.includes('/api/auth/login') ||
      originalRequest?.url?.includes('/api/auth/register') ||
      originalRequest?.url?.includes('/api/auth/refresh') ||
      originalRequest?.url?.includes('/api/auth/forgot-password') ||
      originalRequest?.url?.includes('/api/auth/reset-password');

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest?._retry &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = tokenStorage.getRefreshToken();
        if (!storedRefreshToken) {
          throw new Error('No refresh token available');
        }

        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        const newAccessToken = data.accessToken || data.token;
        const newRefreshToken = data.refreshToken;

        if (!newAccessToken || !newRefreshToken) {
          throw new Error('Invalid token refresh response from server');
        }

        // Replace both stored tokens with newly rotated pair
        tokenStorage.setTokens(newAccessToken, newRefreshToken);
        setAuthToken(newAccessToken);

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        tokenStorage.clearTokens();
        setAuthToken(null);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * ============================================================================
 * AUTHENTICATION API SERVICES
 * ============================================================================
 */

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/login', payload);
  return data;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/register', payload);
  return data;
}

export async function logoutUser(refreshToken?: string | null): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post('/api/auth/logout', { refreshToken });
  return data;
}

export async function forgotPasswordUser(payload: ForgotPasswordPayload): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post('/api/auth/forgot-password', payload);
  return data;
}

export async function resetPasswordUser(payload: ResetPasswordPayload): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post('/api/auth/reset-password', payload);
  return data;
}

export async function getCurrentUser(): Promise<{ success: boolean; user: User }> {
  const { data } = await api.get('/api/auth/me');
  return data;
}

/**
 * ============================================================================
 * CORE DATA API SERVICES (Verified Part 1 endpoints with wrapper normalization)
 * ============================================================================
 */

export async function getDashboard(): Promise<DashboardData> {
  const { data } = await api.get('/api/dashboard');
  return data?.data || data;
}

export async function getTransactions(): Promise<Transaction[]> {
  const { data } = await api.get('/api/transactions');
  return Array.isArray(data) ? data : data?.data || [];
}

export async function getLiabilities(): Promise<Liability[]> {
  const { data } = await api.get('/api/liabilities');
  return Array.isArray(data) ? data : data?.data || [];
}

export async function getAssets(): Promise<Asset[]> {
  const { data } = await api.get('/api/assets');
  return Array.isArray(data) ? data : data?.data || [];
}

export async function getIncome(): Promise<IncomeRecord[]> {
  const { data } = await api.get('/api/income');
  return Array.isArray(data) ? data : data?.data || [];
}
export const getIncomes = getIncome;

export async function getAlerts(): Promise<AlertItem[]> {
  const { data } = await api.get('/api/alerts');
  return Array.isArray(data) ? data : data?.data || [];
}

export async function getFMI(): Promise<{ current: FMIResponse; history: FMIRecord[] }> {
  const [currentRes, historyRes] = await Promise.all([
    api.get('/api/fmi'),
    api.get('/api/fmi/history'),
  ]);
  const current = currentRes.data?.data || currentRes.data;
  const history = Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.data || [];
  return { current, history };
}

export async function getFMIHistory(): Promise<FMIRecord[]> {
  const { data } = await api.get('/api/fmi/history');
  return Array.isArray(data) ? data : data?.data || [];
}

export async function getPredictability(params?: Record<string, any>): Promise<PredictabilitySnapshot> {
  const { data } = await api.get('/api/predictability', { params });
  return data?.data || data;
}

/**
 * ============================================================================
 * ACTIVITY WORKSPACE API SERVICES (PART 4 SPECIFICATION)
 * ============================================================================
 */

// ── Transactions ─────────────────────────────────────────────────────────────

export async function createTransaction(payload: TransactionPayload): Promise<Transaction> {
  const { data } = await api.post('/api/transactions', payload);
  return data?.data || data;
}

export async function updateTransaction(id: string, payload: Partial<TransactionPayload>): Promise<Transaction> {
  const { data } = await api.put(`/api/transactions/${id}`, payload);
  return data?.data || data;
}

export async function deleteTransaction(id: string): Promise<{ success: boolean; id: string }> {
  const { data } = await api.delete(`/api/transactions/${id}`);
  return data;
}

export async function classifyExpense(text: string): Promise<ClassifierSuggestion> {
  const { data } = await api.post<ClassifierSuggestion>('/api/classify', { text });
  return data;
}

// ── Income ───────────────────────────────────────────────────────────────────

export async function createIncome(payload: IncomePayload): Promise<IncomeRecord> {
  const { data } = await api.post('/api/income', payload);
  return data?.data || data;
}

export async function updateIncome(id: string, payload: Partial<IncomePayload>): Promise<IncomeRecord> {
  const { data } = await api.put(`/api/income/${id}`, payload);
  return data?.data || data;
}

export async function deleteIncome(id: string): Promise<{ success: boolean; id: string }> {
  const { data } = await api.delete(`/api/income/${id}`);
  return data;
}

export async function getIncomeFlow(): Promise<IncomeFlowResponse> {
  const { data } = await api.get('/api/income/flow');
  return data?.data || data;
}

// ── Liabilities ──────────────────────────────────────────────────────────────

export async function createLiability(payload: LiabilityPayload): Promise<Liability> {
  const { data } = await api.post('/api/liabilities', payload);
  return data?.data || data;
}

export async function updateLiability(id: string, payload: Partial<LiabilityPayload>): Promise<Liability> {
  const { data } = await api.put(`/api/liabilities/${id}`, payload);
  return data?.data || data;
}

export async function deleteLiability(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete(`/api/liabilities/${id}`);
  return data;
}

export async function getLiabilityTransactions(
  id: string,
  page: number = 1,
  limit: number = 20
): Promise<LiabilityTransactionsResponse> {
  const { data } = await api.get(`/api/liabilities/${id}/transactions`, {
    params: { page, limit },
  });
  return data?.data || data;
}

export async function getLiabilitiesPaymentsSummary(): Promise<Record<string, LiabilitiesPaymentSummaryItem>> {
  const { data } = await api.get('/api/liabilities/payments-summary');
  return data?.data || data || {};
}

/**
 * ============================================================================
 * INSIGHTS WORKSPACE API SERVICES (PART 5 SPECIFICATION)
 * ============================================================================
 */

export async function getBehavior(): Promise<BehaviorResponse> {
  const { data } = await api.get('/api/behavior');
  return data?.data || data || { patterns: [], analyzedCount: 0 };
}

/**
 * ============================================================================
 * PLANNING WORKSPACE API SERVICES (PART 6 SPECIFICATION)
 * ============================================================================
 */

// ── Assets CRUD ─────────────────────────────────────────────────────────────

export async function createAsset(payload: Omit<Asset, 'id'>): Promise<Asset> {
  const { data } = await api.post('/api/assets', payload);
  return data?.data || data;
}

export async function updateAsset(id: string, payload: Partial<Asset>): Promise<Asset> {
  const { data } = await api.put(`/api/assets/${id}`, payload);
  return data?.data || data;
}

export async function deleteAsset(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete(`/api/assets/${id}`);
  return data;
}

// ── Goals CRUD ──────────────────────────────────────────────────────────────

export async function getGoals(): Promise<Goal[]> {
  const { data } = await api.get('/api/goals');
  return Array.isArray(data) ? data : data?.data || [];
}

export async function createGoal(payload: {
  name: string;
  emoji?: string;
  targetAmount: number;
  targetDate?: string;
  monthlyContribution?: number;
}): Promise<Goal> {
  const { data } = await api.post('/api/goals', payload);
  return data?.data || data;
}

export async function updateGoal(id: string, payload: Partial<Goal>): Promise<Goal> {
  const { data } = await api.put(`/api/goals/${id}`, payload);
  return data?.data || data;
}

export async function deleteGoal(id: string): Promise<{ message: string }> {
  const { data } = await api.delete(`/api/goals/${id}`);
  return data;
}

// ── Scenario Lab Evaluation ──────────────────────────────────────────────────

export async function evaluateScenario(overrides: ScenarioOverrides): Promise<PredictabilitySnapshot> {
  const { data } = await api.post('/api/predictability/scenario', overrides);
  return data?.data || data;
}

// ── Reports Workspace Services ──────────────────────────────────────────────

export async function getWeeklyReport(): Promise<WeeklyReport> {
  const { data } = await api.get('/api/reports/weekly');
  return data?.data || data;
}

export async function getPacingReport(): Promise<PacingReport> {
  const { data } = await api.get('/api/reports/pacing');
  return data?.data || data;
}

export async function getMonthlyReport(year?: number, month?: number): Promise<MonthlyReport> {
  const params: Record<string, number> = {};
  if (year !== undefined) params.year = year;
  if (month !== undefined) params.month = month;
  const { data } = await api.get('/api/reports/monthly', { params });
  return data?.data || data;
}

export async function getHeatmapReport(): Promise<HeatmapPoint[]> {
  const { data } = await api.get('/api/reports/heatmap');
  return data?.data || data;
}

