const VARIANTS = {
  amber: { color: 'var(--color-stamp-amber)', bg: 'var(--color-stamp-amber-bg)' },
  green: { color: 'var(--color-ledger-green)', bg: 'var(--color-ledger-green-bg)' },
  red: { color: 'var(--color-stamp-red)', bg: 'var(--color-stamp-red-bg)' },
};

export default function StatusStamp({ children, variant = 'amber' }) {
  const v = VARIANTS[variant] || VARIANTS.amber;
  return (
    <span className="stamp" style={{ color: v.color, backgroundColor: v.bg }}>
      {children}
    </span>
  );
}
