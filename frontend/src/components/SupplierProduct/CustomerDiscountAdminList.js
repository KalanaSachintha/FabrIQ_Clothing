import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export default function CustomerDiscountAdminList() {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchAll = async (signal) => {
    try {
      const [loyaltyRes, supplierRes] = await Promise.allSettled([
        fetch(`${API_ROOT}/api/loyalty`, { headers: { ...authHeader }, signal }),
        fetch(`${API_ROOT}/api/supplier-discounts`, { headers: { ...authHeader }, signal }),
      ]);

      const nextItems = [];

      if (loyaltyRes.status === "fulfilled") {
        const r = loyaltyRes.value;
        if (r && r.ok) {
          const payload = await r.json().catch(() => []);
          const list = Array.isArray(payload) ? payload : payload?.discounts || [];
          for (const d of list) nextItems.push({ type: "loyalty", doc: d });
        } else {
          console.debug("loyalty endpoint not ok", r && r.status);
        }
      } else {
        console.debug("loyalty fetch failed", loyaltyRes.reason);
      }

      if (supplierRes.status === "fulfilled") {
        const r2 = supplierRes.value;
        if (r2 && r2.ok) {
          const payload2 = await r2.json().catch(() => []);
          const list2 = Array.isArray(payload2) ? payload2 : [];
          for (const d of list2) nextItems.push({ type: "supplier", doc: d });
        } else {
          console.debug("supplier-discounts endpoint not ok", r2 && r2.status);
        }
      } else {
        console.debug("supplier-discounts fetch failed", supplierRes.reason);
      }

      return nextItems;
    } catch (err) {
      console.error("fetchAll error", err);
      throw err;
    }
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    (async () => {
      try {
        const list = await fetchAll(controller.signal);
        if (!cancelled) setItems(list);
      } catch (err) {
        if (!cancelled) setError("Failed to load discounts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const onChange = (ev) => {
      try {
        const data = ev?.detail || {};
        if (data.action === "created" && data.discount) {
          setItems((prev) => [{ type: "supplier", doc: data.discount }, ...prev]);
        } else if (data.action === "deleted" && data.id) {
          setItems((prev) => prev.filter((it) => (it.doc._id || it.doc.id) !== data.id));
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener("supplier-discounts-changed", onChange);
    const onLoyaltyChange = async (ev) => {
      try {
        // Refresh the list when loyalty discounts are assigned
        const list = await fetchAll();
        setItems(list);
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener("loyalty-discounts-changed", onLoyaltyChange);

    const poll = setInterval(async () => {
      try {
        const list = await fetchAll();
        setItems(list);
      } catch (e) {
        // noop
      }
    }, 10000);

    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener("supplier-discounts-changed", onChange);
      window.removeEventListener("loyalty-discounts-changed", onLoyaltyChange);
      clearInterval(poll);
    };
  }, [authHeader, token]);

  const handleRefresh = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchAll();
      setItems(list);
    } catch (e) {
      setError("Failed to refresh discounts");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (it) => {
    const id = it.doc._id || it.doc.id;
    if (!id) return;
    if (!window.confirm('Remove this discount?')) return;

    try {
      const url = it.type === 'loyalty' ? `${API_ROOT}/api/loyalty/${id}` : `${API_ROOT}/api/supplier-discounts/${id}`;
      const res = await fetch(url, { method: 'DELETE', headers: { ...authHeader, 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('delete failed');
      setItems((prev) => prev.filter((p) => (p.doc._id || p.doc.id) !== id));
    } catch (e) {
      console.error('delete error', e);
      setError('Failed to remove discount');
    }
  };

  const [editingItem, setEditingItem] = React.useState(null);
  const [form, setForm] = React.useState({ discountPercent: '', minSpend: '', minQuantity: '', note: '', description: '', expiresAt: '' });
  const [saving, setSaving] = React.useState(false);

  const openEdit = (it) => {
    if (!it) return;
    const d = it.doc || {};
    setEditingItem(it);
    setForm({
      discountPercent: d.discountPercent ?? d.discountAmount ?? '',
      minSpend: typeof d.minSpend !== 'undefined' ? String(d.minSpend) : '',
      minQuantity: typeof d.minQuantity !== 'undefined' ? String(d.minQuantity) : '',
      note: d.note || '',
      description: d.description || '',
      expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().slice(0, 10) : '',
    });
    setError('');
  };

  const closeEdit = () => {
    setEditingItem(null);
    setForm({ discountPercent: '', minSpend: '', minQuantity: '', note: '', description: '', expiresAt: '' });
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    const id = editingItem.doc._id || editingItem.doc.id;
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      if (editingItem.type === 'loyalty') {
        const payload = {
          discountPercent: Number(form.discountPercent),
          minSpend: Number(form.minSpend) || 0,
          description: form.description || undefined,
          expiresAt: form.expiresAt || undefined,
        };
        const res = await fetch(`${API_ROOT}/api/loyalty/${id}`, { method: 'PUT', headers: { ...authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'update failed');
        }
        const json = await res.json().catch(() => ({}));
        const updated = json.discount || { ...editingItem.doc, ...payload };
        setItems((prev) => prev.map((p) => ((p.doc._id || p.doc.id) === id ? { ...p, doc: updated } : p)));
      } else {
        const payload = {
          discountPercent: Number(form.discountPercent),
          minQuantity: Math.floor(Number(form.minQuantity) || 0),
          note: form.note || undefined,
        };
        const res = await fetch(`${API_ROOT}/api/supplier-discounts/${id}`, { method: 'PUT', headers: { ...authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'update failed');
        }
        const json = await res.json().catch(() => ({}));
        const updated = json.discount || { ...editingItem.doc, ...payload };
        setItems((prev) => prev.map((p) => ((p.doc._id || p.doc.id) === id ? { ...p, doc: updated } : p)));
      }
      closeEdit();
    } catch (e) {
      console.error('saveEdit error', e);
      setError(e.message || 'Failed to update discount');
      setSaving(false);
    }
  };

  const isAdmin = user && String(user.role || '').toLowerCase() === 'admin';

  if (!token) return null;

  return (
    <div className="card stack-md">
      <div className="stack-xs">
        <h3 className="heading-md">Customer discounts</h3>
        <p className="muted-text text-sm">View discounts assigned to customers or offered on products.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={handleRefresh} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="empty-cell">Loading discounts…</div>
      ) : items.length === 0 ? (
        <div className="empty-cell">No discounts found.</div>
      ) : (
        <div className="table-scroller">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Discount</th>
                <th>Minimum spend</th>
                <th>Note / Expires</th>
                {isAdmin && <th>Actions</th>}
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const key = it.doc._id || it.doc.id || idx;
                if (it.type === 'loyalty') {
                  const d = it.doc;
                  const created = d.createdAt ? new Date(d.createdAt) : null;
                  const expires = d.expiresAt ? new Date(d.expiresAt) : null;
                  return (
                    <tr key={key}>
                      <td>{idx + 1}</td>
                      <td>{formatPercent(d.discountPercent)}</td>
                      <td>{typeof d.minSpend === 'number' && d.minSpend > 0 ? new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(d.minSpend) : '—'}</td>
                      <td>
                        <div className="stack-xxs">
                          <div className="muted-text text-xs">{d.description || '—'}</div>
                          <div className="muted-text text-xs">{expires ? expires.toLocaleDateString() : 'No expiry'}</div>
                        </div>
                      </td>
                      {isAdmin ? (
                        <td>
                          <div style={{display: 'flex', gap: 6}}>
                            <button className="btn btn-outline btn-xs" onClick={() => openEdit(it)} type="button">Edit</button>
                            <button className="btn btn-danger btn-xs" onClick={() => handleDelete(it)} type="button">Delete</button>
                          </div>
                        </td>
                      ) : null}
                        <td>{created ? created.toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                }

                // supplier discount fallback
                const s = it.doc;
                const supplierName = s.supplierId?.name || 'Supplier';
                const productName = s.productId?.name || 'Product';
                const created = s.createdAt ? new Date(s.createdAt) : null;
                return (
                  <tr key={key}>
                    <td>{idx + 1}</td>
                    <td>{formatPercent(s.discountPercent ?? s.discountAmount ?? 0)}</td>
                    <td>{'—'}</td>
                    <td>
                      <div className="muted-text text-xs">Min qty: {Number(s.minQuantity || 0).toLocaleString()}</div>
                    </td>
                    {isAdmin ? (
                      <td>
                        <div style={{display: 'flex', gap: 6}}>
                          <button className="btn btn-outline btn-xs" onClick={() => openEdit(it)} type="button">Edit</button>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(it)} type="button">Delete</button>
                        </div>
                      </td>
                    ) : null}
                    <td>{created ? created.toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingItem && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200}}>
          <div className="card" style={{width: 560, maxWidth: '94%', padding: 18}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h4 className="heading-sm">Edit discount</h4>
              <button className="btn btn-ghost" onClick={closeEdit} aria-label="Close">×</button>
            </div>

            <div className="stack-sm" style={{marginTop: 8}}>
              <label className="text-xs">Discount percent</label>
              <input className="input" type="number" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} />

              {editingItem.type === 'loyalty' ? (
                <>
                  <label className="text-xs">Minimum spend (LKR)</label>
                  <input className="input" type="number" value={form.minSpend} onChange={(e) => setForm((f) => ({ ...f, minSpend: e.target.value }))} />

                  <label className="text-xs">Description / Note</label>
                  <input className="input" type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

                  <label className="text-xs">Expires at</label>
                  <input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
                </>
              ) : (
                <>
                  <label className="text-xs">Minimum quantity</label>
                  <input className="input" type="number" value={form.minQuantity} onChange={(e) => setForm((f) => ({ ...f, minQuantity: e.target.value }))} />

                  <label className="text-xs">Note</label>
                  <input className="input" type="text" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                </>
              )}
            </div>

            {error && <div className="alert alert-danger" style={{marginTop: 8}}>{error}</div>}

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12}}>
              <button className="btn btn-outline" onClick={closeEdit} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
