import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import StatusStamp from '../components/StatusStamp';
import { useAuth } from '../context/AuthContext';

const emptyForm = { name: '', category: '', rackLocation: '', costPrice: '', sellingPrice: '', expiryDate: '', lowStockThreshold: 5, quantity: 0 };

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  function load(q = '') {
    client.get('/products', { params: q ? { search: q } : {} }).then(({ data }) => setProducts(data));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  function openAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setShowForm(true);
  }

  function openEdit(p) {
    setForm({
      name: p.name, category: p.category || '', rackLocation: p.rackLocation || '',
      costPrice: p.costPrice, sellingPrice: p.sellingPrice, expiryDate: p.expiryDate || '',
      lowStockThreshold: p.lowStockThreshold, quantity: p.Inventory?.currentQuantity ?? 0,
    });
    setEditingId(p.id);
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await client.put(`/products/${editingId}`, form);
      } else {
        await client.post('/products', form);
      }
      setShowForm(false);
      load(search);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save product');
    }
  }

  function stockStatus(p) {
    const qty = p.Inventory?.currentQuantity ?? 0;
    if (qty === 0) return <StatusStamp variant="red">Out of stock</StatusStamp>;
    if (qty <= p.lowStockThreshold) return <StatusStamp variant="amber">Low stock</StatusStamp>;
    return null;
  }

  function expiryStatus(p) {
    if (!p.expiryDate) return null;
    const days = Math.ceil((new Date(p.expiryDate) - new Date()) / 86400000);
    if (days <= 15) return <StatusStamp variant="red">Expires in {days}d</StatusStamp>;
    return null;
  }

  return (
    <Layout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold mb-1">Products</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Your full catalog, with rack location and live stock.</p>
        </div>
        {user.role === 'admin' && (
          <button onClick={openAdd} className="text-white text-sm font-medium px-4 py-2 rounded" style={{ background: 'var(--color-ink)' }}>
            + Add product
          </button>
        )}
      </div>

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, category, or rack…"
        className="w-full max-w-md border border-[var(--color-rule)] rounded px-3 py-2 text-sm mb-5 bg-white"
      />

      <div className="ledger-card rounded-b-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-rule)]">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Rack</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {user.role === 'admin' && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-[var(--color-rule)] last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{p.category}</div>
                </td>
                <td className="px-4 py-3 mono-num text-xs">{p.rackLocation || '—'}</td>
                <td className="px-4 py-3 mono-num">{p.Inventory?.currentQuantity ?? 0}</td>
                <td className="px-4 py-3 mono-num">₹{p.sellingPrice}</td>
                <td className="px-4 py-3 space-x-1.5 whitespace-nowrap">{stockStatus(p)}{expiryStatus(p)}</td>
                {user.role === 'admin' && (
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-xs underline text-[var(--color-text-muted)]">Edit</button>
                  </td>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} className="ledger-card rounded-b-md p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <h2 className="font-[var(--font-display)] text-lg font-semibold mb-4">{editingId ? 'Edit product' : 'Add product'}</h2>

            <Field label="Product name">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            </Field>
            <Field label="Category">
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" />
            </Field>
            <Field label="Rack location">
              <input value={form.rackLocation} onChange={(e) => setForm({ ...form, rackLocation: e.target.value })} className="input" placeholder="Rack 3" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cost price (₹)">
                <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className="input" />
              </Field>
              <Field label="Selling price (₹)">
                <input type="number" step="0.01" required value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={editingId ? 'Low stock alert at' : 'Initial quantity'}>
                {editingId ? (
                  <input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="input" />
                ) : (
                  <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="input" />
                )}
              </Field>
              <Field label="Expiry date">
                <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="input" />
              </Field>
            </div>
            {!editingId && (
              <Field label="Low stock alert at">
                <input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="input" />
              </Field>
            )}

            {error && <div className="text-sm mb-3 px-3 py-2 rounded" style={{ color: 'var(--color-stamp-red)', background: 'var(--color-stamp-red-bg)' }}>{error}</div>}

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 text-sm py-2 rounded border border-[var(--color-rule)]">Cancel</button>
              <button type="submit" className="flex-1 text-white text-sm font-medium py-2 rounded" style={{ background: 'var(--color-ink)' }}>
                {editingId ? 'Save changes' : 'Add product'}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`.input { width: 100%; border: 1px solid var(--color-rule); border-radius: 4px; padding: 0.5rem 0.75rem; font-size: 0.875rem; margin-bottom: 1rem; }`}</style>
    </Layout>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
