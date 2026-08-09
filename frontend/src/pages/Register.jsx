import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { registerShop } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ shopName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerShop(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-10" style={{ background: 'var(--color-ink)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-[var(--font-display)] text-3xl text-white font-semibold">Ledger</div>
          <div className="text-white/50 text-sm mt-1">Set up your shop's account</div>
        </div>
        <form onSubmit={handleSubmit} className="ledger-card rounded-b-md p-6">
          <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Shop name</label>
          <input required value={form.shopName} onChange={update('shopName')}
            className="w-full border border-[var(--color-rule)] rounded px-3 py-2 mb-4 text-sm" placeholder="Sharma General Store" />

          <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Email</label>
          <input type="email" required value={form.email} onChange={update('email')}
            className="w-full border border-[var(--color-rule)] rounded px-3 py-2 mb-4 text-sm" placeholder="you@shop.com" />

          <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Phone (optional)</label>
          <input value={form.phone} onChange={update('phone')}
            className="w-full border border-[var(--color-rule)] rounded px-3 py-2 mb-4 text-sm" placeholder="9999999999" />

          <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Password</label>
          <input type="password" required minLength={6} value={form.password} onChange={update('password')}
            className="w-full border border-[var(--color-rule)] rounded px-3 py-2 mb-4 text-sm" placeholder="At least 6 characters" />

          {error && <div className="text-sm mb-4 px-3 py-2 rounded" style={{ color: 'var(--color-stamp-red)', background: 'var(--color-stamp-red-bg)' }}>{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full text-white text-sm font-medium py-2.5 rounded disabled:opacity-60" style={{ background: 'var(--color-ink)' }}>
            {loading ? 'Creating your shop…' : 'Create shop account'}
          </button>
        </form>
        <div className="text-center text-white/50 text-sm mt-4">
          Already registered? <Link to="/login" className="text-white underline">Log in</Link>
        </div>
      </div>
    </div>
  );
}
