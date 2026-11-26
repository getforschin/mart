import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { ExpiryDashboardPage } from './pages/ExpiryDashboardPage';
import './styles/global.css';

function AppLayout(): JSX.Element {
  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <h1>Mart Admin</h1>
          <span>Omnichannel Control</span>
        </div>
        <ul className="sidebar__nav">
          <li>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Expiry Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/lots" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Lot Tracking
            </NavLink>
          </li>
        </ul>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ExpiryDashboardPage />} />
          <Route
            path="/lots"
            element={
              <div className="placeholder-page">
                <h2>Lot Tracking</h2>
                <p>Integrated with central-backend ProductLot inventory endpoints.</p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
