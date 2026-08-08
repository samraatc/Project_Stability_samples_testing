import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'esms_access_token';

/** Access token stored in memory with fallback to storage for page reloads. */
let accessToken: string | null = (() => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
})();

export function setAccessToken(token: string | null, rememberMe = true): void {
  accessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
      if (rememberMe) {
        localStorage.setItem(TOKEN_KEY, token);
      }
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    try {
      accessToken = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    } catch {
      accessToken = null;
    }
  }
  return accessToken;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v1';

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Deduplicates concurrent refresh attempts. */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshUrl = `${apiBaseUrl.replace(/\/$/, '')}/auth/refresh`;
    const res = await axios.post<{ data: { accessToken: string } }>(
      refreshUrl,
      {},
      { withCredentials: true },
    );
    const token = res.data.data.accessToken;
    setAccessToken(token);
    return token;
  } catch {
    const existing = getAccessToken();
    if (existing) {
      return existing;
    }
    setAccessToken(null);
    return null;
  }
}

export function requestRefresh(): Promise<string | null> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

const NO_RETRY_URLS = ['/auth/login', '/auth/refresh', '/auth/logout'];

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as RetriableConfig | undefined;
  const url = original?.url ?? '';

  if (
    error.response?.status === 401 &&
    original &&
    !original._retry &&
    !NO_RETRY_URLS.some((u) => url.startsWith(u))
  ) {
    original._retry = true;
    const token = await requestRefresh();
    if (token) {
      return api(original);
    }
  }

  return Promise.reject(error);
});
