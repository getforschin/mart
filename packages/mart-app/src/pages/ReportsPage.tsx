import { useEffect, useState } from 'react';
import { useDataPort } from '../context';

export function ReportsPage(): JSX.Element {
  const port = useDataPort();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void port
      .getReports()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed'));
  }, [port]);

  return (
    <div className="mart-page">
      <h2>Reports</h2>
      <p className="lead">Sales and inventory summary.</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-cards">
        {Object.entries(data ?? {}).slice(0, 8).map(([key, value]) => (
          <div className="mart-card" key={key}>
            <span>{key}</span>
            <strong>{typeof value === 'number' ? value : String(value ?? '—')}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
