import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function load() {
    client.get('/auth/staff').then(({ data }) => setStaff(data));
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await client.post('/auth/staff', form);
      setSuccess(`Staff account created for ${form.name}. Share their email and password so they can log in.`);
      setForm({ name: '', email: '', password: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create staff account');
    }
  }

  return (
    <Layout>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold mb-1">Staff</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Give hired help their own login — every sale they enter is tracked against their name.</p>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="ledger-card rounded-b-md divide-y divide-[var(--color-rule)]">
            {staff.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{s.email}</div>
                </div>
                <span className="mono-num text-xs uppercase text-[var(--color-text-muted)]">{s.role}</span>
              </div>
            ))}
            {staff.length === 0 && <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No staff accounts yet.</div>}
          </div>
        </div>

        <div>
          <form onSubmit={handleSubmit} className="ledger-card rounded-b-md p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-3">Add staff account</div>
            <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-[var(--color-rule)] rounded px-3 py-2 text-sm mb-3" />
            <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-[var(--color-rule)] rounded px-3 py-2 text-sm mb-3" />
            <input required type="password" minLength={6} placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-[var(--color-rule)] rounded px-3 py-2 text-sm mb-3" />
            {error && <div className="text-sm mb-3 px-3 py-2 rounded" style={{ color: 'var(--color-stamp-red)', background: 'var(--color-stamp-red-bg)' }}>{error}</div>}
            {success && <div className="text-sm mb-3 px-3 py-2 rounded" style={{ color: 'var(--color-ledger-green)', background: 'var(--color-ledger-green-bg)' }}>{success}</div>}
            <button type="submit" className="w-full text-white text-sm font-medium py-2 rounded" style={{ background: 'var(--color-ink)' }}>
              Create account
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
