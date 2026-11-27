import { useEffect, useMemo, useState } from 'react';
import { AppShell, MartAppProvider } from '@mart/app';
import '@mart/app/styles.css';
import { PosSession } from '../../shared/types';
import { LoginPage } from './pages/LoginPage';
import { PosBillingPage } from './pages/PosBillingPage';
import { createOfflinePort } from './ports/offlinePort';
import './styles/global.css';

export default function App(): JSX.Element {
  const [session, setSession] = useState<PosSession | null>(null);
  const [booting, setBooting] = useState(true);
  const port = useMemo(() => createOfflinePort(), []);

  useEffect(() => {
    void window
      .posApi!.getSession()
      .then((existing) => setSession(existing))
      .finally(() => setBooting(false));
  }, []);

  const handleLogout = (): void => {
    void window.posApi!.logout().then(() => setSession(null));
  };

  if (booting) {
    return (
      <div className="boot-screen">
        <p>Loading Mart POS…</p>
      </div>
    );
  }

  if (session === null) {
    return <LoginPage onLoggedIn={setSession} />;
  }

  return (
    <MartAppProvider port={port}>
      <AppShell
        brand="CNP Mart POS"
        onLogout={handleLogout}
        initialModule="billing"
        billingSlot={<PosBillingPage session={session} embedded />}
      />
    </MartAppProvider>
  );
}
