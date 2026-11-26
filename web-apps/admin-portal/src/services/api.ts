const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

export function getTenantId(): string {
  return localStorage.getItem('mart_tenant_id') ?? TENANT_ID;
}

export function getToken(): string {
  return localStorage.getItem('mart_token') ?? 'dev';
}

export function setAuth(token: string, tenantId: string, user: unknown): void {
  localStorage.setItem('mart_token', token);
  localStorage.setItem('mart_tenant_id', tenantId);
  localStorage.setItem('mart_user', JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem('mart_token');
  localStorage.removeItem('mart_tenant_id');
  localStorage.removeItem('mart_user');
}

export function getStoredUser(): { fullName?: string; username?: string; role?: string } | null {
  const raw = localStorage.getItem('mart_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { fullName?: string; username?: string; role?: string };
  } catch {
    return null;
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tenantId = getTenantId();
  const url = path.includes('?')
    ? `${API_BASE}${path}&tenantId=${tenantId}`
    : `${API_BASE}${path}?tenantId=${tenantId}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const martApi = {
  login: (username: string, password: string) =>
    fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async (r) => {
      if (!r.ok) throw new Error('Invalid login');
      return r.json() as Promise<{ token: string; user: { tenantId: string; fullName: string; username: string; role: string } }>;
    }),

  dashboard: () => api<Record<string, unknown>>('/api/v1/dashboard'),
  products: () => api<Array<Record<string, unknown>>>('/api/v1/catalog/products'),
  saveProduct: (body: Record<string, unknown>) =>
    api('/api/v1/catalog/products', { method: 'POST', body: JSON.stringify(body) }),
  operators: () => api<Array<Record<string, unknown>>>('/api/v1/catalog/operators'),
  facilities: () => api<Array<Record<string, unknown>>>('/api/v1/catalog/facilities'),
  sessions: () => api<Array<Record<string, unknown>>>('/api/v1/catalog/sessions'),
  customers: () => api<Array<Record<string, unknown>>>('/api/v1/parties/customers'),
  saveCustomer: (body: Record<string, unknown>) =>
    api('/api/v1/parties/customers', { method: 'POST', body: JSON.stringify(body) }),
  suppliers: () => api<Array<Record<string, unknown>>>('/api/v1/parties/suppliers'),
  saveSupplier: (body: Record<string, unknown>) =>
    api('/api/v1/parties/suppliers', { method: 'POST', body: JSON.stringify(body) }),
  purchases: () => api<Array<Record<string, unknown>>>('/api/v1/purchases'),
  createPurchase: (body: Record<string, unknown>) =>
    api('/api/v1/purchases', { method: 'POST', body: JSON.stringify(body) }),
  stock: (facilityId?: string) =>
    api<Array<Record<string, unknown>>>(`/api/v1/stock${facilityId ? `?facilityId=${facilityId}&` : '?'}`.replace('?&', '?').replace(/\?$/, '') || '/api/v1/stock'),
  stockList: (facilityId?: string) =>
    api<Array<Record<string, unknown>>>(
      facilityId ? `/api/v1/stock?facilityId=${facilityId}` : '/api/v1/stock',
    ),
  transfers: () => api<Array<Record<string, unknown>>>('/api/v1/stock/transfers'),
  createTransfer: (body: Record<string, unknown>) =>
    api('/api/v1/stock/transfers', { method: 'POST', body: JSON.stringify(body) }),
  dumpStock: (body: Record<string, unknown>) =>
    api('/api/v1/stock/dump', { method: 'POST', body: JSON.stringify(body) }),
  schemes: () => api<Array<Record<string, unknown>>>('/api/v1/schemes'),
  saveScheme: (body: Record<string, unknown>) =>
    api('/api/v1/schemes', { method: 'POST', body: JSON.stringify(body) }),
  sales: () => api<Array<Record<string, unknown>>>('/api/v1/sales'),
  createSale: (body: Record<string, unknown>) =>
    api('/api/v1/sales', { method: 'POST', body: JSON.stringify(body) }),
  accountHeads: () => api<Array<Record<string, unknown>>>('/api/v1/accounts/heads'),
  accountEntries: (partyType?: string) =>
    api<Array<Record<string, unknown>>>(
      partyType ? `/api/v1/accounts/entries?partyType=${partyType}` : '/api/v1/accounts/entries',
    ),
  createEntry: (body: Record<string, unknown>) =>
    api('/api/v1/accounts/entries', { method: 'POST', body: JSON.stringify(body) }),
  sms: () => api<Array<Record<string, unknown>>>('/api/v1/sms'),
  sendSms: (body: Record<string, unknown>) =>
    api('/api/v1/sms/send', { method: 'POST', body: JSON.stringify(body) }),
  coupons: () => api<Array<Record<string, unknown>>>('/api/v1/ecommerce/coupons'),
  ecommerceOrders: () => api<Array<Record<string, unknown>>>('/api/v1/ecommerce/orders'),
  reports: () => api<Record<string, unknown>>('/api/v1/reports'),
  expiry: () =>
    api<Record<string, unknown>>(
      `/api/v1/analytics/expiry/${getTenantId()}`.replace(`?tenantId=${getTenantId()}`, ''),
    ).catch(async () => {
      const response = await fetch(`${API_BASE}/api/v1/analytics/expiry/${getTenantId()}`, {
        headers: { 'X-Tenant-Id': getTenantId(), Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) throw new Error('Expiry fetch failed');
      return response.json();
    }),
};
