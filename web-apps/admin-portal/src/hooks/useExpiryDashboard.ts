import { useCallback, useEffect, useState } from 'react';
import { ExpiryDashboard, fetchExpiryDashboard } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? '';
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN ?? '';

interface DashboardState {
  dashboard: ExpiryDashboard | null;
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
}

export function useExpiryDashboard(autoRefreshMs = 60000): DashboardState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<DashboardState>({
    dashboard: null,
    loading: true,
    error: null,
    lastRefreshed: null,
  });

  const refresh = useCallback(async (): Promise<void> => {
    if (!TENANT_ID) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'VITE_TENANT_ID environment variable is not configured',
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const dashboard = await fetchExpiryDashboard({
        baseUrl: API_BASE_URL,
        tenantId: TENANT_ID,
        authToken: AUTH_TOKEN,
      });
      setState({
        dashboard,
        loading: false,
        error: null,
        lastRefreshed: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error fetching dashboard';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), autoRefreshMs);
    return () => window.clearInterval(intervalId);
  }, [refresh, autoRefreshMs]);

  return { ...state, refresh };
}
