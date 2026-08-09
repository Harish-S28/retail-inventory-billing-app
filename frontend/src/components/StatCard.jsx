export default function StatCard({ label, value, sub, accent = 'ink' }) {
  const accentColor = {
    ink: 'var(--color-text-ink)',
    green: 'var(--color-ledger-green)',
    amber: 'var(--color-stamp-amber)',
    red: 'var(--color-stamp-red)',
  }[accent];

  return (
    <div className="ledger-card rounded-b-md px-5 py-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">{label}</div>
      <div className="mono-num text-2xl font-semibold mt-1" style={{ color: accentColor }}>{value}</div>
      {sub && <div className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</div>}
    </div>
  );
}
