import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const REFRESH_KEY = 'obt_refresh_token';

let accessToken: string | null = null;

export function setAuthToken(token: string | null) {
  accessToken = token;
}

async function getStoredRefresh(): Promise<string | null> {
  try { return await AsyncStorage.getItem(REFRESH_KEY); } catch { return null; }
}

async function storeRefresh(token: string | null) {
  try {
    if (token) await AsyncStorage.setItem(REFRESH_KEY, token);
    else await AsyncStorage.removeItem(REFRESH_KEY);
  } catch {}
}

async function refreshAccessToken(): Promise<boolean> {
  const rt = await getStoredRefresh();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) { await storeRefresh(null); return false; }
    const data = await res.json();
    accessToken = data.accessToken;
    if (data.refreshToken) await storeRefresh(data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !retried) {
    const ok = await refreshAccessToken();
    if (ok) return request<T>(method, path, body, true);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { const j = await res.json(); message = j.message ?? j.error ?? message; } catch {}
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown)  => request<T>('POST',   path, body),
  put:    <T>(path: string, body?: unknown)  => request<T>('PUT',    path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};

export async function apiLogin(email: string, password: string) {
  const data = await api.post<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; name: string; email: string; role: string; orgId: string };
  }>('/auth/login', { email, password });
  accessToken = data.accessToken;
  await storeRefresh(data.refreshToken);
  return data;
}

export async function apiLogout() {
  try { await api.post('/auth/logout'); } catch {}
  accessToken = null;
  await storeRefresh(null);
}
