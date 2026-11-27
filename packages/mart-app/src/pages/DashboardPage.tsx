import { useEffect, useMemo, useState } from 'react';
import { useDataPort } from '../context';
import type {
  MartDashboard,
  MartDashboardHourlyPoint,
  MartDashboardLowStockItem,
  MartDashboardPaymentMix,
} from '../types';

function money(value: unknown): string {
  return `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function moneyExact(value: unknown): string {
  return `₹${Number(value ?? 0).toFixed(2)}`;
}

function OrdersPulseChart({ points }: { points: MartDashboardHourlyPoint[] }): JSX.Element {
  const width = 640;
  const height = 132;
  const pad = { top: 10, right: 8, bottom: 20, left: 22 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxOrders = Math.max(1, ...points.map((p) => p.orders));
  const active = points.filter((p) => p.orders > 0 || p.hour <= new Date().getHours());
  const series = active.length > 0 ? active : points;

  const coords = series.map((p, i) => {
    const x = pad.left + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
    const y = pad.top + innerH - (p.orders / maxOrders) * innerH;
    return { ...p, x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area =
    coords.length > 0
      ? `${line} L${coords[coords.length - 1].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} L${coords[0].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`
      : '';

  const tickEvery = Math.max(1, Math.ceil(series.length / 8));

  return (
    <svg className="dash-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Today orders by hour">
      <defs>
        <linearGradient id="dashOrdersFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6b4f" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2f6b4f" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.top + innerH * (1 - t);
        return (
          <line
            key={t}
            x1={pad.left}
            x2={width - pad.right}
            y1={y}
            y2={y}
            className="dash-chart__grid"
          />
        );
      })}
      {area ? <path d={area} fill="url(#dashOrdersFill)" /> : null}
      {line ? <path d={line} className="dash-chart__line" fill="none" /> : null}
      {coords.map((c) =>
        c.orders > 0 ? (
          <g key={c.hour}>
            <circle cx={c.x} cy={c.y} r={4.5} className="dash-chart__dot" />
            <title>
              {c.label}: {c.orders} order{c.orders === 1 ? '' : 's'} · {moneyExact(c.sales)}
            </title>
          </g>
        ) : null,
      )}
      {coords.map((c, i) =>
        i % tickEvery === 0 || i === coords.length - 1 ? (
          <text key={`t-${c.hour}`} x={c.x} y={height - 8} textAnchor="middle" className="dash-chart__tick">
            {c.label.slice(0, 2)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function PaymentMixBars({ rows }: { rows: MartDashboardPaymentMix[] }): JSX.Element {
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0) || 1;
  if (rows.length === 0) {
    return <p className="mart-muted">No payments yet today.</p>;
  }
  return (
    <div className="dash-mix">
      {rows.map((row) => {
        const pct = Math.round((Number(row.amount) / total) * 100);
        return (
          <div key={row.channel} className="dash-mix__row">
            <div className="dash-mix__meta">
              <span>{row.channel}</span>
              <strong>
                {moneyExact(row.amount)} · {pct}%
              </strong>
            </div>
            <div className="dash-mix__track">
              <div className="dash-mix__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardPage(): JSX.Element {
  const port = useDataPort();
  const [data, setData] = useState<MartDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void port
      .getDashboard()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [port]);

  const todayNet = Number(data?.todayNetSales ?? data?.totalSales ?? data?.salesTotal ?? 0);
  const todayOrders = Number(data?.todayOrderCount ?? data?.todayInvoiceCount ?? 0);
  const newCustomers = Number(data?.newCustomersThisMonth ?? 0);
  const lowStock = Number(data?.lowStockCount ?? 0);
  const outOfStock = Number(data?.outOfStockCount ?? 0);
  const hourly = (data?.todayHourlyOrders as MartDashboardHourlyPoint[] | undefined) ?? [];
  const paymentMix = (data?.paymentMixToday as MartDashboardPaymentMix[] | undefined) ?? [];
  const lowStockItems = (data?.lowStockItems as MartDashboardLowStockItem[] | undefined) ?? [];
  const recentSales = data?.recentSales ?? [];

  const peakHour = useMemo(() => {
    if (!hourly.length) return null;
    return hourly.reduce((best, row) => (row.orders > best.orders ? row : best), hourly[0]);
  }, [hourly]);

  const nowLabel = new Date().toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mart-page dash">
      <div className="dash-hero">
        <div>
          <p className="dash-kicker">Store pulse · {port.mode === 'offline' ? 'POS local' : 'Central'}</p>
          <h2>Today at a glance</h2>
        </div>
        <time className="dash-asof" dateTime={new Date().toISOString()}>
          {nowLabel}
        </time>
      </div>

      {error ? <p className="mart-error">{error}</p> : null}

      <div className="dash-kpis">
        <article className="dash-kpi dash-kpi--primary">
          <span className="dash-kpi__label">Today&apos;s net sales</span>
          <strong className="dash-kpi__value">{money(todayNet)}</strong>
          <span className="dash-kpi__hint">Sales minus returns</span>
        </article>
        <article className="dash-kpi">
          <span className="dash-kpi__label">Today&apos;s orders</span>
          <strong className="dash-kpi__value">{todayOrders}</strong>
          <span className="dash-kpi__hint">
            {peakHour && peakHour.orders > 0 ? `Peak ${peakHour.label}` : 'Bills + returns'}
          </span>
        </article>
        <article className="dash-kpi">
          <span className="dash-kpi__label">New customers</span>
          <strong className="dash-kpi__value">{newCustomers}</strong>
          <span className="dash-kpi__hint">This month</span>
        </article>
        <article className={`dash-kpi ${lowStock > 0 ? 'dash-kpi--alert' : ''}`}>
          <span className="dash-kpi__label">Low stock</span>
          <strong className="dash-kpi__value">{lowStock}</strong>
          <span className="dash-kpi__hint">{outOfStock > 0 ? `${outOfStock} out of stock` : 'Needs reorder'}</span>
        </article>
      </div>

      <div className="dash-grid">
        <section className="dash-panel dash-panel--chart">
          <header className="dash-panel__head">
            <h3>Orders today</h3>
          </header>
          <OrdersPulseChart points={hourly} />
        </section>

        <section className="dash-panel">
          <header className="dash-panel__head">
            <h3>Payment mix</h3>
          </header>
          <PaymentMixBars rows={paymentMix} />
        </section>

        <section className="dash-panel">
          <header className="dash-panel__head">
            <h3>Low stock</h3>
          </header>
          {lowStockItems.length === 0 ? (
            <p className="mart-muted">No alerts.</p>
          ) : (
            <ul className="dash-list">
              {lowStockItems.slice(0, 5).map((item) => (
                <li key={`${item.productId}-${item.sku}`}>
                  <div>
                    <strong>{item.productName}</strong>
                    <span className="mart-muted">{item.sku}</span>
                  </div>
                  <span className={`dash-qty ${item.quantityOnHand <= 0 ? 'dash-qty--out' : ''}`}>
                    {item.quantityOnHand}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-panel dash-panel--wide">
          <header className="dash-panel__head">
            <h3>Latest bills</h3>
          </header>
          {recentSales.length === 0 ? (
            <p className="mart-muted">No sales yet.</p>
          ) : (
            <div className="mart-table-wrap dash-table">
              <table className="mart-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Pay</th>
                    <th>Amount</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.slice(0, 5).map((row) => (
                    <tr key={row.id}>
                      <td>{row.invoiceNumber ?? row.id.slice(0, 8)}</td>
                      <td>{row.paymentChannel}</td>
                      <td>{moneyExact(row.finalPayable)}</td>
                      <td>{String(row.createdAt).slice(11, 16) || String(row.createdAt).slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
