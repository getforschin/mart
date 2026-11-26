import { useEffect, useState } from 'react';
import { PosConfig, PosFacility, PosSession } from '../../shared/types';

interface LoginPageProps {
  onLoggedIn: (session: PosSession) => void;
}

export function LoginPage({ onLoggedIn }: LoginPageProps): JSX.Element {
  const [config, setConfig] = useState<PosConfig | null>(null);
  const [facilities, setFacilities] = useState<PosFacility[]>([]);
  const [facilityId, setFacilityId] = useState('');
  const [username, setUsername] = useState('cashier');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void Promise.all([window.posApi!.getConfig(), window.posApi!.getFacilities()]).then(
      ([cfg, facs]) => {
        setConfig(cfg);
        setFacilities(facs);
        if (facs.length > 0) {
          setFacilityId(facs[0].id);
        }
      },
    );
  }, []);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await window.posApi!.login({ username, password, facilityId });
      onLoggedIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>{config?.shopName ?? 'Mart POS'}</h1>
          <p>Point of Sale — Easy Retail For You</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="login-form">
          <label>
            Center / Store
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              required
            >
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error !== null && <p className="login-error">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
            {loading ? 'Signing in…' : 'Login to POS'}
          </button>
        </form>

        <div className="login-hint">
          <p>
            <strong>Demo:</strong> cashier / admin123
          </p>
          <p>
            <strong>Manager:</strong> manager / manager123
          </p>
        </div>
      </div>
    </div>
  );
}
