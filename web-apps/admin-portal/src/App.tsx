import { useMemo } from 'react';
import { AppShell, MartAppProvider, createOnlinePort } from '@mart/app';
import '@mart/app/styles.css';
import './styles/global.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';
const FACILITY_ID = import.meta.env.VITE_FACILITY_ID ?? '00000000-0000-0000-0000-000000000002';

export default function App(): JSX.Element {
  const port = useMemo(
    () =>
      createOnlinePort({
        apiBaseUrl: API_BASE.replace(/\/$/, ''),
        tenantId: localStorage.getItem('mart_tenant_id') ?? TENANT_ID,
        facilityId: FACILITY_ID,
        getToken: () => localStorage.getItem('mart_token') ?? 'dev',
        session: {
          displayName: 'Admin',
          facilityName: 'Central Admin',
          role: 'MART_ADMIN',
        },
      }),
    [],
  );

  return (
    <MartAppProvider port={port}>
      <AppShell brand="Mart Admin" initialModule="billing" />
    </MartAppProvider>
  );
}
