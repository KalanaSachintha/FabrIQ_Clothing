import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import "../Customer/BulkOrder.css";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const AdminBulkOrders = () => {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [pricingList, setPricingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [pricingForm, setPricingForm] = useState({
    id: "",
    quality: "",
    priceUnder20: "",
    priceUnder50: "",
    priceUnder100: "",
    priceUnder250: "",
    price250AndAbove: ""
  });

  useEffect(() => {
    fetchOrders();
    fetchPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ROOT}/api/bulk-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch bulk orders");
      setOrders(data);
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricing = async () => {
    try {
      const response = await fetch(`${API_ROOT}/api/bulk-pricing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setPricingList(data);
      }
    } catch (error) {
      console.error("Failed to fetch pricing", error);
    }
  };

  const handlePricingChange = (e) => {
    setPricingForm({ ...pricingForm, [e.target.name]: e.target.value });
  };

  const savePricing = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      const response = await fetch(`${API_ROOT}/api/bulk-pricing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(pricingForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save pricing");
      setMsg("Pricing rule saved successfully!");
      setPricingForm({
        id: "", quality: "", priceUnder20: "", priceUnder50: "", priceUnder100: "", priceUnder250: "", price250AndAbove: ""
      });
      fetchPricing();
    } catch (error) {
      setErr(error.message);
    }
  };

  const editPricing = (pkg) => {
    setPricingForm({
      id: pkg._id,
      quality: pkg.quality,
      priceUnder20: pkg.priceUnder20,
      priceUnder50: pkg.priceUnder50,
      priceUnder100: pkg.priceUnder100,
      priceUnder250: pkg.priceUnder250,
      price250AndAbove: pkg.price250AndAbove
    });
    setMsg("");
    setErr("");
  };

  const deletePricing = async (id) => {
    if (!window.confirm("Delete this pricing rule?")) return;
    try {
      const response = await fetch(`${API_ROOT}/api/bulk-pricing/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setMsg("Pricing removed!");
        fetchPricing();
      }
    } catch (err) {
      setErr("Failed to delete");
    }
  };

  const getFullImageUrl = (url) => {
    if (!url) return "";
    return `${API_ROOT}${url}`;
  };

  if (loading && orders.length === 0) return <div className="admin-bulk-orders">Loading bulk orders...</div>;

  return (
    <div className="admin-bulk-orders stack-lg">
      <div className="card">
        <h2>Bulk Orders Config & Pricing</h2>
        <p className="muted-text text-sm mb-4">Set dynamic pricing per t-shirt quality to show customers the latest estimated costs.</p>
        
        {msg && <div className="bulk-order-msg success">{msg}</div>}
        {err && <div className="bulk-order-msg error">{err}</div>}

        <form onSubmit={savePricing} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <div className="form-group">
            <label className="text-xs">Quality Label (e.g. 190GSM)</label>
            <input type="text" name="quality" value={pricingForm.quality} onChange={handlePricingChange} required className="input input-sm" />
          </div>
          <div className="form-group">
             <label className="text-xs">Price &lt; 20 pcs</label>
             <input type="number" name="priceUnder20" value={pricingForm.priceUnder20} onChange={handlePricingChange} required className="input input-sm" />
          </div>
          <div className="form-group">
             <label className="text-xs">Price &lt; 50 pcs</label>
             <input type="number" name="priceUnder50" value={pricingForm.priceUnder50} onChange={handlePricingChange} required className="input input-sm" />
          </div>
          <div className="form-group">
             <label className="text-xs">Price &lt; 100 pcs</label>
             <input type="number" name="priceUnder100" value={pricingForm.priceUnder100} onChange={handlePricingChange} required className="input input-sm" />
          </div>
          <div className="form-group">
             <label className="text-xs">Price &lt; 250 pcs</label>
             <input type="number" name="priceUnder250" value={pricingForm.priceUnder250} onChange={handlePricingChange} required className="input input-sm" />
          </div>
          <div className="form-group">
             <label className="text-xs">Price &gt;= 250 pcs</label>
             <input type="number" name="price250AndAbove" value={pricingForm.price250AndAbove} onChange={handlePricingChange} required className="input input-sm" />
          </div>
          <div className="lg:col-span-3">
             <button type="submit" className="btn btn-primary btn-sm">Save Pricing Rule</button>
             {pricingForm.id && (
               <button type="button" className="btn btn-outline btn-sm ml-2" onClick={() => setPricingForm({id: "", quality: "", priceUnder20: "", priceUnder50: "", priceUnder100: "", priceUnder250: "", price250AndAbove: ""})}>Cancel Edit</button>
             )}
          </div>
        </form>

        {pricingList.length > 0 && (
          <div className="table-scroller">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quality</th>
                  <th>&lt;20</th>
                  <th>&lt;50</th>
                  <th>&lt;100</th>
                  <th>&lt;250</th>
                  <th>250+</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pricingList.map(p => (
                  <tr key={p._id}>
                    <td className="font-bold">{p.quality}</td>
                    <td>Rs. {p.priceUnder20}</td>
                    <td>Rs. {p.priceUnder50}</td>
                    <td>Rs. {p.priceUnder100}</td>
                    <td>Rs. {p.priceUnder250}</td>
                    <td>Rs. {p.price250AndAbove}</td>
                    <td className="text-right">
                      <button className="btn btn-secondary btn-sm mr-2" onClick={() => editPricing(p)}>Edit</button>
                      <button className="btn btn-outline btn-sm" onClick={() => deletePricing(p._id)}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Submitted Bulk Orders</h2>
        {orders.length === 0 ? (
          <p className="muted-text">No bulk orders found.</p>
        ) : (
          <div className="table-scroller">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Designs</th>
                  <th>Details</th>
                  <th>Contact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>{order.user?.name || order.user?.email || "Unknown"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <a href={getFullImageUrl(order.image1)} target="_blank" rel="noreferrer">
                          <img src={getFullImageUrl(order.image1)} alt="Design 1" className="w-10 h-10 object-cover rounded" />
                        </a>
                        <a href={getFullImageUrl(order.image2)} target="_blank" rel="noreferrer">
                          <img src={getFullImageUrl(order.image2)} alt="Design 2" className="w-10 h-10 object-cover rounded" />
                        </a>
                      </div>
                    </td>
                    <td>
                      Qty: <strong>{order.quantity}</strong><br/>
                      GSM: {order.quality}
                    </td>
                    <td>{order.contactNumber}</td>
                    <td>
                      <span className="badge badge-amber">{order.status || "Pending"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBulkOrders;
