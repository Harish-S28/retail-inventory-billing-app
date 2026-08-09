import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import client from '../api/client';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [range, setRange] = useState('thisMonth');
  const [customerSummary, setCustomerSummary] = useState(null);
  const [customerGrowth, setCustomerGrowth] = useState([]);

  useEffect(() => {
    client.get('/dashboard/summary').then(({ data }) => setSummary(data));
    client.get('/dashboard/trend?range=30').then(({ data }) => setTrend(data));
    client.get('/dashboard/customer-growth?months=6').then(({ data }) => setCustomerGrowth(data));
  }, []);

  useEffect(() => {
    client.get('/dashboard/customer-summary', { params: { range } }).then(({ data }) => setCustomerSummary(data));
  }, [range]);

  if (!summary) {
    return <Layout><div className="text-sm text-[var(--color-text-muted)]">Loading dashboard…</div></Layout>;
  }

  const current = summary[range];

  return (
    <Layout>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">A snapshot of how the shop's doing.</p>

      <div className="flex gap-2 mb-4">
        {[['today', 'Today'], ['thisMonth', 'This month'], ['thisYear', 'This year']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded border ${range === key ? 'text-white' : 'text-[var(--color-text-muted)]'}`}
            style={{ background: range === key ? 'var(--color-ink)' : 'transparent', borderColor: range === key ? 'var(--color-ink)' : 'var(--color-rule)' }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Revenue" value={`₹${current.revenue}`} accent="ink" />
        <StatCard label="Estimated profit" value={`₹${current.profit}`} accent="green" />
        <StatCard label="Transactions" value={current.transactions} accent="amber" />
        <StatCard label="Units sold" value={current.unitsSold} accent="ink" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="ledger-card rounded-b-md p-5 md:col-span-2">
          <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-3">Revenue — last 30 days</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} tickFormatter={(d) => d.slice(5)} minTickGap={20} />
              <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} />
              <Tooltip contentStyle={{ fontFamily: 'var(--font-mono)', fontSize: 12, borderColor: 'var(--color-rule)' }} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-stamp-amber)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="ledger-card rounded-b-md p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-3">Top products — {range === 'today' ? 'today' : range === 'thisMonth' ? 'this month' : 'this year'}</div>
          {current.topProducts.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No sales recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {current.topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="mono-num text-xs text-[var(--color-text-muted)]">{String(i + 1).padStart(2, '0')}</span>
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="mono-num text-xs shrink-0 ml-2">{p.unitsSold} sold</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {customerSummary && (
        <>
          <div className="flex items-center justify-between mt-10 mb-4">
            <h2 className="font-[var(--font-display)] text-lg font-semibold">Customer analytics</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Known customers" value={customerSummary.totalKnownCustomers} accent="ink" />
            <StatCard label="Unknown sales" value={`${customerSummary.percentUnknownSales}%`} sub={`${customerSummary.unknownSalesCount} of ${customerSummary.knownSalesCount + customerSummary.unknownSalesCount} bills`} accent="amber" />
            <StatCard label="New customers" value={customerSummary.newCustomersInRange} accent="green" />
            <StatCard label="Returning customers" value={customerSummary.returningCustomersInRange} accent="ink" />
            <StatCard label="Avg bill value" value={`₹${customerSummary.avgBillValue}`} accent="ink" />
            <StatCard label="Customer lifetime value" value={`₹${customerSummary.customerLifetimeValue}`} sub="avg. spend per known customer" accent="green" />
            <StatCard label="Repeat purchase rate" value={`${customerSummary.repeatPurchaseRate}%`} sub="of known customers, all-time" accent="amber" />
            <StatCard label="Known vs unknown revenue" value={`₹${customerSummary.knownRevenue} / ₹${customerSummary.unknownRevenue}`} accent="ink" />
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="ledger-card rounded-b-md p-5 md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-3">New vs returning customers — last 6 months</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontFamily: 'var(--font-mono)', fontSize: 12, borderColor: 'var(--color-rule)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="newCustomers" name="New" stackId="a" fill="var(--color-ledger-green)" />
                  <Bar dataKey="returningCustomers" name="Returning" stackId="a" fill="var(--color-stamp-amber)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="ledger-card rounded-b-md p-5">
              <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-3">Top customers</div>
              {customerSummary.topCustomers.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No known customers yet.</p>
              ) : (
                <ul className="space-y-3">
                  {customerSummary.topCustomers.map((c, i) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="mono-num text-xs text-[var(--color-text-muted)]">{String(i + 1).padStart(2, '0')}</span>
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="mono-num text-xs shrink-0 ml-2">₹{c.totalAmountSpent}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
