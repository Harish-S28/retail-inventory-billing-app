```jsx
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '01' },
  { to: '/products', label: 'Products', icon: '02' },
  { to: '/billing', label: 'Billing', icon: '03' },
  { to: '/sales-history', label: 'Sales History', icon: '04' },
  { to: '/customers', label: 'Customers', icon: '05' },
  { to: '/alerts', label: 'Alerts', icon: '06' },
  { to: '/ai-assistant', label: 'AI Assistant', icon: '07' },

  // Customer Segmentation - External ML Application
  {
    external: true,
    label: 'Customer Segmentation',
    icon: '08',
    href: 'https://customer-segmentation-pearl.vercel.app/index.html',
  },

  { to: '/staff', label: 'Staff', icon: '09', adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    let cancelled = false;

    client
      .get('/alerts')
      .then(({ data }) => {
        if (cancelled) return;

        setAlerts(data);

        if (data.totalAlerts > 0) {
          setShowPopup(true);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'var(--color-paper)' }}
    >
      {/* Sidebar */}
      <aside
        className="w-60 shrink-0 text-white flex flex-col"
        style={{ background: 'var(--color-ink)' }}
      >
        {/* Shop Information */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="font-semibold text-base">
            {user?.shopName || 'Your Shop'}
          </div>

          <div className="text-white/60 text-sm mt-1">
            {user?.name} · {user?.role}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {NAV_ITEMS
            .filter(
              (item) => !item.adminOnly || user?.role === 'admin'
            )
            .map((item) => {
              // External application
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors text-white/60 hover:text-white hover:bg-white/5"
                  >
                    <span className="w-6 text-xs opacity-70">
                      {item.icon}
                    </span>

                    <span>{item.label}</span>
                  </a>
                );
              }

              // Internal React route
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <span className="w-6 text-xs opacity-70">
                    {item.icon}
                  </span>

                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>

        {/* Logout */}
        <div className="border-t border-white/10 p-4">
          <button
            onClick={handleLogout}
            className="w-full text-left px-2 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Alert Popup */}
        {alerts && showPopup && alerts.totalAlerts > 0 && (
          <div
            className="ledger-card mx-6 mt-6 rounded-b-md px-5 py-3 flex items-start justify-between gap-4"
            style={{
              borderLeft: '3px solid var(--color-stamp-red)',
            }}
          >
            <div className="text-sm">
              <span
                className="font-semibold"
                style={{
                  color: 'var(--color-stamp-red)',
                }}
              >
                Heads up —
              </span>{' '}

              {alerts.outOfStock.length > 0 && (
                <span>
                  {alerts.outOfStock.length} product(s) out of stock.{' '}
                </span>
              )}

              {alerts.lowStock.length > 0 && (
                <span>
                  {alerts.lowStock.length} product(s) running low.{' '}
                </span>
              )}

              {alerts.expiringSoon.length > 0 && (
                <span>
                  {alerts.expiringSoon.length} product(s) nearing expiry.
                </span>
              )}{' '}

              <NavLink
                to="/alerts"
                className="underline"
                style={{
                  color: 'var(--color-stamp-red)',
                }}
              >
                View details
              </NavLink>
            </div>

            <button
              onClick={() => setShowPopup(false)}
              className="text-[var(--color-text-muted)] text-sm shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```
