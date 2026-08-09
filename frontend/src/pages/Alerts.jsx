import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import StatusStamp from '../components/StatusStamp';

export default function Alerts() {
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    client.get('/alerts').then(({ data }) => setAlerts(data));
  }, []);

  if (!alerts) return <Layout><div className="text-sm text-[var(--color-text-muted)]">Loading alerts…</div></Layout>;

  return (
    <Layout>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold mb-1">Alerts</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Anything that needs your attention before it becomes a problem.</p>

      <Section title="Out of stock" variant="red" items={alerts.outOfStock} render={(p) => (
        <>
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{p.rackLocation}</div>
        </>
      )} empty="Nothing is out of stock right now." />

      <Section title="Running low" variant="amber" items={alerts.lowStock} render={(p) => (
        <>
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{p.rackLocation} · alert threshold {p.threshold}</div>
        </>
      )} valueRender={(p) => `${p.currentQuantity} left`} empty="No products are low on stock." />

      <Section title="Nearing expiry" variant="red" items={alerts.expiringSoon} render={(p) => (
        <>
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{p.rackLocation} · expires {p.expiryDate}</div>
        </>
      )} valueRender={(p) => `${p.daysLeft}d left`} empty="Nothing is nearing expiry in the next 15 days." />
    </Layout>
  );
}

function Section({ title, variant, items, render, valueRender, empty }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-medium text-sm">{title}</h2>
        <StatusStamp variant={variant}>{items.length}</StatusStamp>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-[var(--color-text-muted)]">{empty}</div>
      ) : (
        <div className="ledger-card rounded-b-md divide-y divide-[var(--color-rule)]">
          {items.map((p) => (
            <div key={p.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div>{render(p)}</div>
              {valueRender && <span className="mono-num text-xs">{valueRender(p)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
