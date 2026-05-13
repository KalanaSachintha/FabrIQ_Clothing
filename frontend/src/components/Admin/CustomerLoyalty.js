import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
const API = `${API_ROOT}/api`;

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function CustomerLoyalty() {
  const { token } = useAuth();
  const [amount, setAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountDesc, setDiscountDesc] = useState("");
  const [discountMinSpend, setDiscountMinSpend] = useState(0);
  // selectedIds removed: we will apply to all customers who meet the minimum spend
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    setErr("");
    setResults([]);
    const min = Number(amount);
    if (!Number.isFinite(min) || min <= 0) {
      setErr("Enter a valid amount greater than zero");
      return;
    }

    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch orders (API may return { orders: [...] } or an array)
      const ordersRes = await fetch(`${API}/orders`, { headers });
      if (!ordersRes.ok) throw new Error(`Failed to fetch orders: ${ordersRes.status}`);
      const ordersRaw = await ordersRes.json().catch(() => ({}));
      const orders = Array.isArray(ordersRaw) ? ordersRaw : ordersRaw?.orders ?? [];

      // Aggregate spend per customer
      const spendMap = Object.create(null);
      orders.forEach((order) => {
        if (!order) return;
        const userId = order?.userId || order?.customerId || order?.createdBy || order?.user?._id;
        if (!userId) return;
        const items = Array.isArray(order?.items) ? order.items : order?.orderItems ?? [];
        let orderTotal = 0;
        items.forEach((item) => {
          if (!item) return;
          const qty = Number(item.quantity ?? item.qty ?? 0) || 0;
          const price = Number(item.price ?? item.unitPrice ?? item?.product?.price ?? 0) || 0;
          orderTotal += qty * price;
        });
        if (!spendMap[userId]) spendMap[userId] = { total: 0, orders: 0 };
        spendMap[userId].total += orderTotal;
        spendMap[userId].orders += 1;
      });

      // Filter customers who meet threshold
      const qualifiedIds = Object.keys(spendMap).filter((id) => spendMap[id].total >= min);

      if (qualifiedIds.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Fetch users to display details
      const usersRes = await fetch(`${API}/users`, { headers });
      if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.status}`);
      const usersRaw = await usersRes.json().catch(() => ({}));
      const users = Array.isArray(usersRaw) ? usersRaw : usersRaw?.users ?? [];
      const userById = (Array.isArray(users) ? users : []).reduce((acc, u) => {
        if (u?._id) acc[u._id] = u;
        return acc;
      }, {});

      const out = qualifiedIds.map((id) => ({
        id,
        name: (userById[id]?.name) || userById[id]?.email || `User ${id}`,
        email: userById[id]?.email || "",
        total: spendMap[id].total,
        orders: spendMap[id].orders,
      }));

      // Sort by total desc
      out.sort((a, b) => b.total - a.total);
      setResults(out);
    } catch (ex) {
      setErr(String(ex.message || ex));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="card stack-md">
      <div className="card-heading">
        <h3 className="heading-md">Customer Loyalty</h3>
      </div>

      <div className="card-body">
        <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="label">Minimum spend (Rs.)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Searching…' : 'Find customers'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setAmount(0); setResults([]); setErr(''); }}
            >
              Reset
            </button>
          </div>
        </form>

        {err && <div className="status-banner status-banner--error" style={{ marginTop: 12 }}>{err}</div>}

        <div style={{ marginTop: 16 }}>
          {results.length === 0 && !loading && (
            <p className="muted-text">No customers found for the specified minimum spend.</p>
          )}

          {results.length > 0 && (
            <>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Orders</th>
                      <th>Total spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.email}</td>
                        <td>{r.orders}</td>
                        <td>{currencyFormatter.format(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    
    {/* Discount details card */}
    <div className="card stack-md" style={{ marginTop: 16 }}>
      <div className="card-heading">
        <h3 className="heading-md">Discount Details</h3>
      </div>
      <div className="card-body">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Discount (%)</label>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <label className="label">Minimum spend for eligibility (Rs.)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={discountMinSpend}
              onChange={(e) => setDiscountMinSpend(e.target.value)}
              placeholder="e.g. 5000"
            />
          </div>
          <div>
            <label className="label">Description (shown to customer)</label>
            <textarea
              className="input"
              rows={3}
              value={discountDesc}
              onChange={(e) => setDiscountDesc(e.target.value)}
              placeholder="e.g. 10% off on next purchase as loyalty reward"
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {applyMsg && <div className="muted-text">{applyMsg}</div>}
          <button
            type="button"
            className="btn"
            disabled={applying}
            onClick={async () => {
              setErr("");
              setApplyMsg("");
              const pct = Number(discountPercent) || 0;
              const minSpend = Number(discountMinSpend) || 0;
              if (!Number.isFinite(pct) || pct <= 0) {
                setErr("Enter a discount percent greater than zero to apply.");
                return;
              }
              if (!Number.isFinite(minSpend) || minSpend <= 0) {
                setErr("Enter a minimum spend amount greater than zero for eligibility.");
                return;
              }

              setApplying(true);
              try {
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                // Recompute eligible customers server-side by fetching orders and aggregating spends
                const ordersRes = await fetch(`${API}/orders`, { headers });
                if (!ordersRes.ok) throw new Error(`Failed to fetch orders: ${ordersRes.status}`);
                const ordersRaw = await ordersRes.json().catch(() => ({}));
                const orders = Array.isArray(ordersRaw) ? ordersRaw : ordersRaw?.orders ?? [];

                const spendMap = Object.create(null);
                orders.forEach((order) => {
                  if (!order) return;
                  const userId = order?.userId || order?.customerId || order?.createdBy || order?.user?._id;
                  if (!userId) return;
                  const items = Array.isArray(order?.items) ? order.items : order?.orderItems ?? [];
                  let orderTotal = 0;
                  items.forEach((item) => {
                    if (!item) return;
                    const qty = Number(item.quantity ?? item.qty ?? 0) || 0;
                    const price = Number(item.price ?? item.unitPrice ?? item?.product?.price ?? 0) || 0;
                    orderTotal += qty * price;
                  });
                  if (!spendMap[userId]) spendMap[userId] = 0;
                  spendMap[userId] += orderTotal;
                });

                const qualifiedIds = Object.keys(spendMap).filter((id) => spendMap[id] >= minSpend);
                if (qualifiedIds.length === 0) {
                  setErr('No customers meet the specified minimum spend.');
                  setApplying(false);
                  return;
                }

                const assignHeaders = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
                const res = await fetch(`${API}/loyalty/assign-discount`, {
                  method: "POST",
                  headers: assignHeaders,
                  body: JSON.stringify({ userIds: qualifiedIds, discountPercent: pct, minSpend, description: discountDesc, applyOnNextPurchase: true }),
                });
                if (!res.ok) {
                  const text = await res.text().catch(() => res.statusText);
                  throw new Error(text || `Request failed: ${res.status}`);
                }

                setApplyMsg(`Discount assigned to ${qualifiedIds.length} qualifying customers.`);
                try {
                  window.dispatchEvent(new CustomEvent('loyalty-discounts-changed', { detail: { action: 'created', userIds: qualifiedIds, discountPercent: pct, description: discountDesc } }));
                } catch (e) {
                  // ignore
                }
              } catch (ex) {
                setErr(String(ex.message || ex));
              } finally {
                setApplying(false);
              }
            }}
          >
            {applying ? "Applying…" : "Apply discount to qualifying customers (next purchase)"}
          </button>

          <button type="button" className="btn btn-outline" onClick={() => { setDiscountPercent(0); setDiscountDesc(''); setApplyMsg(''); }}>
            Reset
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
