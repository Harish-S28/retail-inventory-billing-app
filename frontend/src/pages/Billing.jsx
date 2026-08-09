import { useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';

export default function Billing() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]); // { productId, name, rackLocation, price, quantity, available }
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Customer for this bill: either an existing customer picked from the
  // suggestions list, a brand-new name (auto-created on checkout), or
  // "Unknown" for a walk-in who isn't giving a name.
  const [customerName, setCustomerName] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isUnknown, setIsUnknown] = useState(false);

  async function handleCustomerSearch(e) {
    const q = e.target.value;
    setCustomerName(q);
    setSelectedCustomerId(null);
    if (isUnknown) setIsUnknown(false);
    if (!q.trim()) { setCustomerSuggestions([]); return; }
    const { data } = await client.get('/customers', { params: { search: q } });
    setCustomerSuggestions(data);
  }

  function pickCustomer(c) {
    setCustomerName(c.name);
    setSelectedCustomerId(c.id);
    setCustomerSuggestions([]);
  }

  function toggleUnknown() {
    setIsUnknown((prev) => {
      const next = !prev;
      if (next) { setCustomerName(''); setSelectedCustomerId(null); setCustomerSuggestions([]); }
      return next;
    });
  }

  async function handleSearch(e) {
    const q = e.target.value;
    setSearch(q);
    if (!q) { setResults([]); return; }
    const { data } = await client.get('/products', { params: { search: q } });
    setResults(data);
  }

  function addToCart(p) {
    setResults([]);
    setSearch('');
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) {
        return prev.map((i) => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: p.id, name: p.name, rackLocation: p.rackLocation, price: p.sellingPrice, quantity: 1, available: p.Inventory?.currentQuantity ?? 0 }];
    });
  }

  function updateQty(productId, qty) {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i));
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  async function handleCheckout() {
    setError('');
    setSuccess(null);
    setSubmitting(true);
    if (!isUnknown && !customerName.trim()) {
      setError('Enter a customer name, or mark this sale as Unknown / walk-in');
      setSubmitting(false);
      return;
    }
    try {
      const { data } = await client.post('/sales', {
        paymentMode: 'cash',
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        isUnknown,
        customerId: selectedCustomerId || undefined,
        customerName: isUnknown ? undefined : customerName.trim(),
      });
      setSuccess(data);
      setCart([]);
      setCustomerName('');
      setSelectedCustomerId(null);
      setIsUnknown(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not complete sale');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold mb-1">Billing</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Find the product, ring it up, stock updates automatically.</p>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="relative mb-5">
            <input
              value={search} onChange={handleSearch}
              placeholder="Search product by name or rack…"
              className="w-full border border-[var(--color-rule)] rounded px-3 py-2.5 text-sm bg-white"
              autoFocus
            />
            {results.length > 0 && (
              <div className="ledger-card rounded-b-md absolute z-10 w-full mt-1 max-h-72 overflow-y-auto shadow-lg">
                {results.map((p) => (
                  <button
                    key={p.id} onClick={() => addToCart(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-paper)] flex items-center justify-between text-sm border-b border-[var(--color-rule)] last:border-0"
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-2">{p.rackLocation}</span>
                    </span>
                    <span className="mono-num text-xs">₹{p.sellingPrice} · {p.Inventory?.currentQuantity ?? 0} left</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ledger-card rounded-b-md">
            {cart.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
                Search for a product above to start a bill.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-rule)]">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Subtotal</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((i) => (
                    <tr key={i.productId} className="border-b border-[var(--color-rule)] last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{i.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{i.rackLocation}</div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number" min={1} max={i.available} value={i.quantity}
                          onChange={(e) => updateQty(i.productId, Number(e.target.value))}
                          className="mono-num w-16 border border-[var(--color-rule)] rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 mono-num">₹{i.price}</td>
                      <td className="px-4 py-3 mono-num font-medium">₹{(i.price * i.quantity).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removeItem(i.productId)} className="text-xs underline text-[var(--color-text-muted)]">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <div className="ledger-card rounded-b-md p-5 sticky top-6">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-2">Customer</div>
            <div className="relative mb-2">
              <input
                value={customerName}
                onChange={handleCustomerSearch}
                disabled={isUnknown}
                placeholder="Name — new or existing"
                className="w-full border border-[var(--color-rule)] rounded px-3 py-2 text-sm bg-white disabled:bg-[var(--color-paper)] disabled:text-[var(--color-text-muted)]"
              />
              {customerSuggestions.length > 0 && (
                <div className="ledger-card rounded-b-md absolute z-10 w-full mt-1 max-h-48 overflow-y-auto shadow-lg">
                  {customerSuggestions.map((c) => (
                    <button
                      key={c.id} onClick={() => pickCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-[var(--color-paper)] flex items-center justify-between text-sm border-b border-[var(--color-rule)] last:border-0"
                    >
                      <span>{c.name}</span>
                      <span className="mono-num text-xs text-[var(--color-text-muted)]">{c.totalPurchases} bill(s)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-4">
              <input type="checkbox" checked={isUnknown} onChange={toggleUnknown} />
              Unknown / walk-in customer
            </label>

            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--color-text-muted)]">Items</span>
              <span className="mono-num">{cart.reduce((n, i) => n + i.quantity, 0)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold mb-4 pt-3 border-t border-[var(--color-rule)]">
              <span>Total</span>
              <span className="mono-num">₹{total.toFixed(2)}</span>
            </div>
            {error && <div className="text-sm mb-3 px-3 py-2 rounded" style={{ color: 'var(--color-stamp-red)', background: 'var(--color-stamp-red-bg)' }}>{error}</div>}
            <button
              onClick={handleCheckout} disabled={cart.length === 0 || submitting}
              className="w-full text-white text-sm font-medium py-2.5 rounded disabled:opacity-50"
              style={{ background: 'var(--color-ledger-green)' }}
            >
              {submitting ? 'Processing…' : 'Complete sale'}
            </button>
          </div>

          {success && (
            <div className="ledger-card rounded-b-md p-5 mt-4" style={{ borderLeft: '3px solid var(--color-ledger-green)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-ledger-green)' }}>Sale recorded ✓</div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Bill #{success.id} · ₹{success.totalAmount} · stock updated
                {success.Customer && <> · {success.Customer.isUnknown ? 'Unknown customer' : success.Customer.name}</>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
