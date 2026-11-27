import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartCustomer } from '../types';

export function CustomersPage(): JSX.Element {
  const port = useDataPort();
  const [rows, setRows] = useState<MartCustomer[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async (q = query): Promise<void> => {
    setError(null);
    try {
      setRows(await port.listCustomers(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    }
  };

  useEffect(() => {
    void load('');
  }, [port]);

  const save = async (): Promise<void> => {
    try {
      await port.saveCustomer({ name, mobile, email: email || null });
      setName('');
      setMobile('');
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div className="mart-page">
      <h2>Customers</h2>
      <p className="lead">Create and search customers. Offline POS queues them for sync.</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-form">
        <input className="mart-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="mart-input" placeholder="Mobile (10 digits)" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <input className="mart-input" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="button" className="mart-btn" onClick={() => void save()}>Save customer</button>
      </div>
      <div className="mart-toolbar">
        <input className="mart-input" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="mart-btn mart-btn--ghost" onClick={() => void load()}>Search</button>
      </div>
      <div className="mart-table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Due</th>
              <th>Sync</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.mobile}</td>
                <td>₹{row.previousDue.toFixed(2)}</td>
                <td>
                  {row.isSynced === 0 ? (
                    <span className="mart-badge mart-badge--warn">Pending</span>
                  ) : (
                    <span className="mart-badge">Synced</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
