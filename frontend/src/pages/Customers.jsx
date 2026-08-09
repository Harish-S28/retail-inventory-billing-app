import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';

export default function Customers() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(null);

  function load(q) {
    client.get('/customers', { params: q ? { search: q } : {} }).then(({ data }) => setCustomers(data));
  }

  useEffect(() => {
    load();
    client.get('/dashboard/customer-summary', { params: { range: 'thisMonth' } }).then(({ data }) => setReport(data));
  }, []);

  function handleSearch(e) {
    const q = e.target.value;
    setSearch(q);
    load(q);
  }

  return (
    <Layout>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold mb-1">Customers</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Everyone who's bought from the shop by name — search, and see who your regulars are.</p>

      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Known customers" value={report.totalKnownCustomers} accent="ink" />
          <StatCard label="Unknown sales — this month" value={`${report.percentUnknownSales}%`} sub={`${report.unknownSalesCount} of ${report.knownSalesCount + report.unknownSalesCount} bills`} accent="amber" />
          <StatCard label="Known revenue — this month" value={`₹${report.knownRevenue}`} accent="green" />
          <StatCard label="Unknown revenue — this month" value={`₹${report.unknownRevenue}`} accent="amber" />
        </div>
      )}

      <input
        value={search} onChange={handleSearch}
        placeholder="Search by name or phone…"
        className="w-full max-w-md border border-[var(--color-rule)] rounded px-3 py-2.5 text-sm bg-white mb-5"
      />

      <div className="grid md:grid-cols-5 gap-6">
        <div className="md:col-span-3">
          <div className="ledger-card rounded-b-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-rule)]">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Bills</th>
                  <th className="px-4 py-3 font-medium">Spent</th>
                  <th className="px-4 py-3 font-medium">Last purchase</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`border-b border-[var(--color-rule)] last:border-0 cursor-pointer hover:bg-[var(--color-paper)] ${selectedId === c.id ? 'bg-[var(--color-paper)]' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{c.name}{c.phone && <div className="text-xs text-[var(--color-text-muted)] font-normal">{c.phone}</div>}</td>
                    <td className="px-4 py-3 mono-num">{c.totalPurchases}</td>
                    <td className="px-4 py-3 mono-num">₹{c.totalAmountSpent}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
                No customers yet — names entered during billing show up here automatically.
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          {selectedId ? (
            <CustomerDetail id={selectedId} onUpdated={() => load(search)} />
          ) : (
            <div className="ledger-card rounded-b-md p-5 text-sm text-[var(--color-text-muted)]">
              Select a customer to see their purchase history, favorite products, and buying frequency.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function CustomerDetail({ id, onUpdated }) {
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });

  useEffect(() => {
    setDetail(null);
    client.get(`/customers/${id}`).then(({ data }) => {
      setDetail(data);
      setForm({ name: data.customer.name, phone: data.customer.phone || '' });
    });
  }, [id]);

  async function saveEdit() {
    const { data } = await client.put(`/customers/${id}`, form);
    setDetail((d) => ({ ...d, customer: data }));
    setEditing(false);
    onUpdated();
  }

  if (!detail) return <div className="ledger-card rounded-b-md p-5 text-sm text-[var(--color-text-muted)]">Loading…</div>;

  const { customer, purchaseHistory, favoriteProducts, avgDaysBetweenPurchases } = detail;

  return (
    <div className="space-y-4">
      <div className="ledger-card rounded-b-md p-5">
        {editing ? (
          <div className="space-y-2 mb-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-[var(--color-rule)] rounded px-3 py-1.5 text-sm" placeholder="Name" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-[var(--color-rule)] rounded px-3 py-1.5 text-sm" placeholder="Phone (optional)" />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="text-xs font-medium px-3 py-1.5 rounded text-white" style={{ background: 'var(--color-ink)' }}>Save</button>
              <button onClick={() => setEditing(false)} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-[var(--font-display)] text-lg font-semibold">{customer.name}</div>
              {customer.phone && <div className="text-xs text-[var(--color-text-muted)]">{customer.phone}</div>}
            </div>
            <button onClick={() => setEditing(true)} className="text-xs underline text-[var(--color-text-muted)]">Edit</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Total spent" value={`₹${customer.totalAmountSpent}`} />
          <Stat label="Bills" value={customer.totalPurchases} />
          <Stat label="Items bought" value={customer.totalQuantityPurchased} />
          <Stat label="Avg days between visits" value={avgDaysBetweenPurchases ?? '—'} />
        </div>
        <div className="text-xs text-[var(--color-text-muted)] mt-3 pt-3 border-t border-[var(--color-rule)]">
          First purchase {customer.firstPurchaseDate ? new Date(customer.firstPurchaseDate).toLocaleDateString() : '—'}
          {' · '}Last purchase {customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString() : '—'}
        </div>
      </div>

      <div className="ledger-card rounded-b-md p-5">
        <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-3">Favorite products</div>
        {favoriteProducts.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">No purchases yet.</div>
        ) : (
          <div className="space-y-2">
            {favoriteProducts.map((p) => (
              <div key={p.name} className="flex justify-between text-sm">
                <span>{p.name}</span>
                <span className="mono-num text-xs text-[var(--color-text-muted)]">{p.unitsBought} units · ₹{p.spent}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ledger-card rounded-b-md p-5">
        <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-3">Purchase history</div>
        {purchaseHistory.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">No bills yet.</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {purchaseHistory.map((sale) => (
              <div key={sale.id} className="flex justify-between text-sm border-b border-[var(--color-rule)] last:border-0 pb-2">
                <span className="text-xs text-[var(--color-text-muted)]">{new Date(sale.createdAt).toLocaleDateString()} · Bill #{sale.id}</span>
                <span className="mono-num">₹{sale.totalAmount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
      <div className="mono-num font-semibold">{value}</div>
    </div>
  );
}
