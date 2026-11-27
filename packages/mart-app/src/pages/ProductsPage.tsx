import { useEffect, useState } from 'react';
import { useDataPort } from '../context';
import type { MartProduct } from '../types';

export function ProductsPage(): JSX.Element {
  const port = useDataPort();
  const [rows, setRows] = useState<MartProduct[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      setRows(await port.listProducts(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  };

  useEffect(() => {
    void load();
  }, [port]);

  return (
    <div className="mart-page">
      <h2>Products</h2>
      <p className="lead">Catalog products used in billing and purchases.</p>
      {error ? <p className="mart-error">{error}</p> : null}
      <div className="mart-form">
        <input className="mart-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="mart-input" placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
        <input className="mart-input" placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <button
          type="button"
          className="mart-btn"
          onClick={() =>
            void port
              .saveProduct({ name, sku, baseBarcode: barcode })
              .then(() => {
                setName('');
                setSku('');
                setBarcode('');
                return load();
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Save failed'))
          }
        >
          Save product
        </button>
      </div>
      <div className="mart-toolbar">
        <input className="mart-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        <button type="button" className="mart-btn mart-btn--ghost" onClick={() => void load()}>Search</button>
      </div>
      <div className="mart-table-wrap">
        <table className="mart-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Barcode</th>
              <th>Brand</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.sku}</td>
                <td>{row.baseBarcode}</td>
                <td>{row.brand ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
