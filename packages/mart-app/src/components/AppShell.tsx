import { useEffect, useState, type ReactNode } from 'react';
import { MODULE_LABELS, type MartModule, type MartSessionInfo } from '../types';
import { useDataPort } from '../context';
import { SyncStatusHeader } from './SyncStatusHeader';
import { DashboardPage } from '../pages/DashboardPage';
import { CustomersPage } from '../pages/CustomersPage';
import { SuppliersPage } from '../pages/SuppliersPage';
import { PurchasesPage } from '../pages/PurchasesPage';
import { StockPage } from '../pages/StockPage';
import { ProductsPage } from '../pages/ProductsPage';
import { SalesPage } from '../pages/SalesPage';
import { ReportsPage } from '../pages/ReportsPage';
import { ExpiryPage } from '../pages/ExpiryPage';
import { BillingPage } from '../pages/BillingPage';

const NAV_ORDER: MartModule[] = [
  'dashboard',
  'billing',
  'customers',
  'suppliers',
  'purchases',
  'stock',
  'products',
  'sales',
  'reports',
  'expiry',
];

export interface AppShellProps {
  brand?: string;
  onLogout?: () => void;
  /** Optional override for billing (e.g. rich Electron POS billing). */
  billingSlot?: ReactNode;
  initialModule?: MartModule;
}

export function AppShell({
  brand = 'Mart',
  onLogout,
  billingSlot,
  initialModule = 'dashboard',
}: AppShellProps): JSX.Element {
  const port = useDataPort();
  const [module, setModule] = useState<MartModule>(initialModule);
  const [session, setSession] = useState<MartSessionInfo | null>(null);

  useEffect(() => {
    void port.getSessionInfo().then(setSession);
  }, [port]);

  const renderModule = (): ReactNode => {
    switch (module) {
      case 'dashboard':
        return <DashboardPage />;
      case 'billing':
        return billingSlot ?? <BillingPage />;
      case 'customers':
        return <CustomersPage />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'purchases':
        return <PurchasesPage />;
      case 'stock':
        return <StockPage />;
      case 'products':
        return <ProductsPage />;
      case 'sales':
        return <SalesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'expiry':
        return <ExpiryPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className={`mart-shell mart-shell--${port.mode}`}>
      <aside className="mart-sidebar">
        <div className="mart-brand">
          <strong>{brand}</strong>
          <span>{port.mode === 'offline' ? 'POS · Offline-first' : 'Admin · Online'}</span>
        </div>
        <nav className="mart-nav">
          {NAV_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={module === id ? 'active' : undefined}
              onClick={() => setModule(id)}
            >
              {MODULE_LABELS[id]}
            </button>
          ))}
        </nav>
      </aside>
      <div className="mart-main">
        <header className="mart-topbar">
          <div className="mart-topbar__left">
            <strong>{MODULE_LABELS[module]}</strong>
            {session ? (
              <span>
                {session.facilityName} · {session.displayName}
              </span>
            ) : null}
          </div>
          <div className="mart-topbar__right">
            <SyncStatusHeader />
            {onLogout ? (
              <button type="button" className="mart-btn mart-btn--ghost" onClick={onLogout}>
                Logout
              </button>
            ) : null}
          </div>
        </header>
        <div className="mart-content">{renderModule()}</div>
      </div>
    </div>
  );
}
