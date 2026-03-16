import { AUTH_TOKEN_KEY, clearAuthStorage, getStoredValue } from '../utils/appStorage';
import { getApiBaseUrl } from '../utils/native';
import { saveBlobFile } from '../utils/fileDownloads';

const DEFAULT_REQUEST_TIMEOUT_MS = 20000;

/** Resolve base URL at request time so native app always uses production API. */
export function buildApiUrl(endpoint) {
    return `${getApiBaseUrl()}${endpoint}`;
}

const HEALTH_CHECK_TIMEOUT_MS = 5000;

/** GET /api/health with short timeout; for connectivity check (no auth). */
export async function healthCheck() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    try {
        const res = await fetch(buildApiUrl('/health'), { signal: controller.signal });
        clearTimeout(timeoutId);
        return res.ok;
    } catch {
        clearTimeout(timeoutId);
        return false;
    }
}

async function getToken() {
    return getStoredValue(AUTH_TOKEN_KEY);
}

async function redirectToLogin() {
    if (typeof window === 'undefined') {
        return;
    }

    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== '/login') {
        window.location.assign('/login');
    }
}

async function request(endpoint, options = {}) {
    const token = await getToken();
    const {
        headers: optHeaders,
        timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
        ...restOptions
    } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...optHeaders,
        },
        signal: controller.signal,
        ...restOptions,
    };

    let res;
    try {
        res = await fetch(buildApiUrl(endpoint), config);
    } catch (error) {
        clearTimeout(timeoutId);
        if (error?.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
    clearTimeout(timeoutId);

    // Only auto-logout on 401/403 for non-auth endpoints
    const isAuthEndpoint = endpoint.startsWith('/auth/');
    if ((res.status === 401 || res.status === 403) && !isAuthEndpoint) {
        await clearAuthStorage();
        await redirectToLogin();
        throw new Error('Unauthorized');
    }

    // Handle CSV downloads
    if (res.headers.get('content-type')?.includes('text/csv')) {
        return res;
    }

    // Safely parse JSON
    let data;
    const text = await res.text();
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('Invalid server response');
    }

    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// Auth
export const authAPI = {
    signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    verifyOtp: (data) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
    resendOtp: (data) => request('/auth/resend-otp', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    verifyLoginOtp: (data) => request('/auth/verify-login-otp', { method: 'POST', body: JSON.stringify(data) }),
    forgotPassword: (data) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
    resetPassword: (data) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request('/auth/me', { timeoutMs: 8000 }),
    updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
    changePassword: (data) => request('/auth/password', { method: 'PUT', body: JSON.stringify(data) }),
    deleteAccount: (data) => request('/auth/account', { method: 'DELETE', body: JSON.stringify(data) }),
};

// Transactions
export const transactionsAPI = {
    list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/transactions${qs ? `?${qs}` : ''}`);
    },
    getUpcomingRecurring: () => request('/transactions/upcoming-recurring'),
    getSuggestions: () => request('/transactions/suggestions'),
    get: (id) => request(`/transactions/${id}`),
    create: (data) => request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    turnOffRepeat: (id) => request(`/transactions/${id}/repeat-off`, { method: 'PUT' }),
    delete: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
    processRecurring: () => request('/transactions/process-recurring', { method: 'POST' }),
};

// Categories
export const categoriesAPI = {
    list: () => request('/categories'),
    create: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
    syncDefaults: () => request('/categories/sync-defaults', { method: 'POST' }),
};

// Accounts
export const accountsAPI = {
    list: () => request('/accounts'),
    create: (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
};

// Budgets
export const budgetsAPI = {
    list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/budgets${qs ? `?${qs}` : ''}`);
    },
    create: (data) => request('/budgets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/budgets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/budgets/${id}`, { method: 'DELETE' }),
};

// Savings Goals
export const savingsGoalsAPI = {
    list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/savings-goals${qs ? `?${qs}` : ''}`);
    },
    create: (data) => request('/savings-goals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/savings-goals/${id}`, { method: 'DELETE' }),
    recordSavings: (id, amount) => request(`/savings-goals/${id}/record`, { method: 'POST', body: JSON.stringify({ amount }) }),
};

// Stats
export const statsAPI = {
    summary: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/stats/summary${qs ? `?${qs}` : ''}`);
    },
    byCategory: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/stats/by-category${qs ? `?${qs}` : ''}`);
    },
    bySubcategory: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/stats/by-subcategory${qs ? `?${qs}` : ''}`);
    },
    trend: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/stats/trend${qs ? `?${qs}` : ''}`);
    },
    trendByCategory: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/stats/trend-by-category${qs ? `?${qs}` : ''}`);
    },
    calendar: (year, month) => request(`/stats/calendar/${year}/${month}`),
    insights: () => request('/stats/insights'),
    finlyScore: () => request('/stats/finly-score'),
    weeklySummary: () => request('/stats/weekly-summary'),
    forecast: () => request('/stats/forecast'),
};

// Settings
export const settingsAPI = {
    get: () => request('/settings'),
    update: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    backupStatus: () => request('/settings/backup-status'),
    backup: () => request('/settings/backup'),
    restore: (backup) => request('/settings/restore', { method: 'POST', body: JSON.stringify({ backup }) }),
};

// Google Drive
export const gdriveAPI = {
    status: () => request('/gdrive/status'),
    getAuthUrl: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/gdrive/auth-url${qs ? `?${qs}` : ''}`);
    },
    toggleAuto: (enabled) => request('/gdrive/toggle-auto', { method: 'POST', body: JSON.stringify({ enabled }) }),
    backup: () => request('/gdrive/backup', { method: 'POST' }),
    disconnect: () => request('/gdrive/disconnect', { method: 'POST' }),
    listBackups: () => request('/gdrive/backups'),
    restore: (fileId) => request(`/gdrive/restore/${fileId}`, { method: 'POST' }),
};

// AI
export const aiAPI = {
    scanReceipt: (data) => request('/ai/scan-receipt', { method: 'POST', body: JSON.stringify(data) }),
    chat: (data) => request('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),
    getChatHistory: () => request('/ai/chat-history'),
    clearChat: () => request('/ai/clear-chat', { method: 'POST' }),
    getInsights: () => request('/ai/insights'),
    getChartSummary: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/ai/chart-summary${qs ? `?${qs}` : ''}`);
    },
    getBudgetSuggestions: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/ai/budget-suggestions${qs ? `?${qs}` : ''}`);
    },
};

// Export
export const exportAPI = {
    csv: async (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        const res = await request(`/settings/export/csv${qs ? `?${qs}` : ''}`);
        const blob = await res.blob();
        await saveBlobFile({
            blob,
            fileName: 'finly-transactions.csv',
            mimeType: 'text/csv',
        });
    },
};

// Bookmarks
export const bookmarksAPI = {
    list: () => request('/bookmarks'),
    add: (transaction_id) => request('/bookmarks', { method: 'POST', body: JSON.stringify({ transaction_id }) }),
    remove: (transactionId) => request(`/bookmarks/${transactionId}`, { method: 'DELETE' }),
    getIds: () => request('/bookmarks/ids'),
};
