import { useEffect, useState } from 'react';
import { PosSession } from '../../shared/types';
import { LoginPage } from './pages/LoginPage';
import { PosBillingPage } from './pages/PosBillingPage';

export default function App(): JSX.Element {
  const [session, setSession] = useState<PosSession | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    void window.posApi!.getSession()
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

  return <PosBillingPage session={session} onLogout={handleLogout} />;
}
