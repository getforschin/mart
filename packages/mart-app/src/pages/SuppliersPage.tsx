import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartSupplier } from '../types';

export function SuppliersPage(): JSX.Element {
  const port = useDataPort();
  const [rows, setRows] = useState<MartSupplier[]>([]);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      setRows(await port.listSuppliers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  };

  useEffect(() => {
    void load();
  }, [port]);

  return (
    <div className="mart-page">
      <h2>Suppliers</h2>
      <p className="lead">Supplier master for purchase bills.</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-form">
        <input className="mart-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="mart-input" placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <button
          type="button"
          className="mart-btn"
          onClick={() =>
            void port
              .saveSupplier({ name, mobile })
              .then(() => {
                setName('');
                setMobile('');
                return load();
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Save failed'))
          }
        >
          Save supplier
        </button>
      </div>
      <div className="mart-table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>GSTIN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.mobile ?? '—'}</td>
                <td>{row.gstin ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
