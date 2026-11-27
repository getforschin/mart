import { useEffect, useState, type ReactNode } from 'react';
import { MODULE_LABELS, type MartModule, type MartSessionInfo } from '../types';
import { useDataPort } from '../context';
import { SyncStatusHeader } from './SyncStatusHeader';
import { DashboardPage } from '../pages/DashboardPage';
import { CustomersPage } from '../pages/CustomersPage';
import { SuppliersPage } from '../pages/SuppliersPage';
import { PurchasesPage } from '../pages/PurchasesPage';
import { ExpensesPage } from '../pages/ExpensesPage';
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
  'expenses',
  'stock',
  'products',
  'sales',
  'reports',
  'expiry',
];

/** Primary tabs for mobile bottom bar (Admin). */
const MOBILE_PRIMARY: MartModule[] = ['billing', 'customers', 'stock', 'sales', 'dashboard'];

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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void port.getSessionInfo().then(setSession);
  }, [port]);

  const go = (id: MartModule): void => {
    setModule(id);
    setMenuOpen(false);
  };

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
      case 'expenses':
        return <ExpensesPage />;
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

  const mobileFirst = port.mode === 'online';

  return (
    <div
      className={`mart-shell mart-shell--${port.mode} ${mobileFirst ? 'mart-shell--mobile-first' : ''} ${
        menuOpen ? 'mart-shell--menu-open' : ''
      }`}
    >
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
              onClick={() => go(id)}
            >
              {MODULE_LABELS[id]}
            </button>
          ))}
        </nav>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          className="mart-drawer-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="mart-main">
        <header className="mart-topbar">
          <div className="mart-topbar__left">
            {mobileFirst ? (
              <button
                type="button"
                className="mart-menu-btn"
                aria-label="Open menu"
                onClick={() => setMenuOpen((o) => !o)}
              >
                ☰
              </button>
            ) : null}
            <div>
              <strong>{MODULE_LABELS[module]}</strong>
              {session ? (
                <span>
                  {session.facilityName} · {session.displayName}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mart-topbar__right">
            <SyncStatusHeader compact={mobileFirst} />
            {onLogout ? (
              <button type="button" className="mart-btn mart-btn--ghost" onClick={onLogout}>
                Logout
              </button>
            ) : null}
          </div>
        </header>
        <div className="mart-content">{renderModule()}</div>
      </div>

      {mobileFirst ? (
        <nav className="mart-bottom-nav" aria-label="Primary">
          {MOBILE_PRIMARY.map((id) => (
            <button
              key={id}
              type="button"
              className={module === id ? 'active' : undefined}
              onClick={() => go(id)}
            >
              <span className="mart-bottom-nav__label">{MODULE_LABELS[id].split(' ')[0]}</span>
            </button>
          ))}
          <button type="button" onClick={() => setMenuOpen(true)}>
            <span className="mart-bottom-nav__label">More</span>
          </button>
        </nav>
      ) : null}
    </div>
  );
}
