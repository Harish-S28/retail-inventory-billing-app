import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export default function SalesHistory() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', userId: '' });

  useEffect(() => {
    if (user.role === 'admin') {
      client.get('/auth/staff').then(({ data }) => setStaffList(data));
    }
  }, [user.role]);

  function load() {
    const params = {};
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.userId) params.userId = filters.userId;
    client.get('/sales', { params }).then(({ data }) => setSales(data));
  }

  useEffect(() => { load(); }, [filters]);

  return (
    <Layout>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold mb-1">Sales History</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Every sale, permanently logged with who processed it.</p>

      <div className="flex flex-wrap gap-3 mb-5">
        <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          className="border border-[var(--color-rule)] rounded px-3 py-1.5 text-sm bg-white" />
        <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          className="border border-[var(--color-rule)] rounded px-3 py-1.5 text-sm bg-white" />
        {user.role === 'admin' && (
          <select value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            className="border border-[var(--color-rule)] rounded px-3 py-1.5 text-sm bg-white">
            <option value="">All staff</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {(filters.startDate || filters.endDate || filters.userId) && (
          <button onClick={() => setFilters({ startDate: '', endDate: '', userId: '' })} className="text-xs underline text-[var(--color-text-muted)]">Clear filters</button>
        )}
      </div>

      <div className="space-y-3">
        {sales.map((sale) => (
          <div key={sale.id} className="ledger-card rounded-b-md px-5 py-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <div>
                <span className="font-medium">Bill #{sale.id}</span>
                <span className="text-xs text-[var(--color-text-muted)] ml-2">
                  {new Date(sale.createdAt).toLocaleString()} · by {sale.User?.name}
                  {sale.Customer && (
                    <> · {sale.Customer.isUnknown ? 'Unknown customer' : sale.Customer.name}</>
                  )}
                </span>
              </div>
              <span className="mono-num font-semibold">₹{sale.totalAmount}</span>
            </div>
            <div className="text-xs text-[var(--color-text-muted)] flex flex-wrap gap-x-4 gap-y-1">
              {sale.items.map((item) => (
                <span key={item.id} className="mono-num">
                  {item.Product?.name} × {item.quantitySold} @ ₹{item.priceAtSale}
                </span>
              ))}
            </div>
          </div>
        ))}
        {sales.length === 0 && (
          <div className="text-center text-sm text-[var(--color-text-muted)] py-10">No sales found for this filter.</div>
        )}
      </div>
    </Layout>
  );
}
