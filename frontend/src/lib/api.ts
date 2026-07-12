import axios from 'axios';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
// PaaS service refs may provide a bare host — ensure a scheme is present.
const API_URL = /^https?:\/\//.test(RAW_API_URL) ? RAW_API_URL : `https://${RAW_API_URL}`;

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('accessToken', token);
    else localStorage.removeItem('accessToken');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') accessToken = localStorage.getItem('accessToken');
  return accessToken;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Send the user to a route once (guards against redirect loops / SSR). */
function redirectTo(path: string): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname + window.location.search === path) return;
  window.location.assign(path);
}

// Auto-refresh on 401 once; on hard auth failure, redirect to login.
let refreshing = false;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // Never auto-refresh/redirect on the auth endpoints themselves — a 401 there is
    // a real answer (bad credentials, 2FA required, expired reset link) the caller
    // needs to see, not a stale-token signal.
    if (typeof original?.url === 'string' && original.url.includes('/auth/')) {
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && original && !original._retry && !refreshing) {
      original._retry = true;
      refreshing = true;
      try {
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
        setAccessToken(data.accessToken);
        refreshing = false;
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        // Session fully expired / not authenticated → clear + bounce to login.
        refreshing = false;
        setAccessToken(null);
        redirectTo('/?auth=required');
      }
    }
    return Promise.reject(error);
  },
);
