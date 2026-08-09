import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-ink)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-[var(--font-display)] text-3xl text-white font-semibold">Ledger</div>
          <div className="text-white/50 text-sm mt-1">Inventory & billing for your shop</div>
        </div>
        <form onSubmit={handleSubmit} className="ledger-card rounded-b-md p-6">
          <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Email</label>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[var(--color-rule)] rounded px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': 'var(--color-stamp-amber)' }}
            placeholder="you@shop.com"
          />
          <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Password</label>
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-[var(--color-rule)] rounded px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2"
            placeholder="••••••••"
          />
          {error && <div className="text-sm mb-4 px-3 py-2 rounded" style={{ color: 'var(--color-stamp-red)', background: 'var(--color-stamp-red-bg)' }}>{error}</div>}
          <button
            type="submit" disabled={loading}
            className="w-full text-white text-sm font-medium py-2.5 rounded disabled:opacity-60"
            style={{ background: 'var(--color-ink)' }}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <div className="text-center text-white/50 text-sm mt-4">
          New shop? <Link to="/register" className="text-white underline">Register here</Link>
        </div>
      </div>
    </div>
  );
}
