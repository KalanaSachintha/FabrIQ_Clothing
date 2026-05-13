import React, { useState, useEffect } from "react";
import "./BulkOrder.css";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Upload, Package, Ruler, Phone, Sparkles, CheckCircle } from "lucide-react";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const BulkOrderForm = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    quantity: "",
    quality: "",
    contactNumber: "",
  });
  const [images, setImages] = useState({ image1: null, image2: null });
  const [pricingList, setPricingList] = useState([]);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    const fetchPricing = async () => {
      try {
        const response = await fetch(`${API_ROOT}/api/bulk-pricing`, {
           headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
          setPricingList(data);
          if (data.length > 0) {
            setFormData(prev => ({ ...prev, quality: data[0].quality }));
          }
        }
      } catch (error) {
        console.error("Failed to load pricing options", error);
      }
    };
    fetchPricing();
  }, [user, navigate, token]);

  useEffect(() => {
    const qty = parseInt(formData.quantity);
    if (!qty || !formData.quality || pricingList.length === 0) {
      setEstimatedPrice(0);
      return;
    }
    const match = pricingList.find(p => p.quality === formData.quality);
    if (!match) {
      setEstimatedPrice(0);
      return;
    }

    let unit = 0;
    if (qty < 20) unit = match.priceUnder20;
    else if (qty < 50) unit = match.priceUnder50;
    else if (qty < 100) unit = match.priceUnder100;
    else if (qty < 250) unit = match.priceUnder250;
    else unit = match.price250AndAbove;

    setEstimatedPrice(qty * unit);
  }, [formData.quantity, formData.quality, pricingList]);


  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    setImages({ ...images, [e.target.name]: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!images.image1 || !images.image2) {
      setErr("Both design images are required.");
      return;
    }

    if (formData.quantity < 1) {
      setErr("Quantity must be greater than 0.");
      return;
    }
    
    if (!formData.quality) {
      setErr("Please select a quality type.");
      return;
    }

    try {
      setLoading(true);
      const data = new FormData();
      data.append("user", user._id || user.id);
      data.append("quantity", formData.quantity);
      data.append("quality", formData.quality);
      data.append("contactNumber", formData.contactNumber);
      data.append("image1", images.image1);
      data.append("image2", images.image2);

      const response = await fetch(`${API_ROOT}/api/bulk-orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.message || "Failed to submit bulk order");

      setMsg("Bulk order submitted successfully!");
      setFormData({ quantity: "", quality: pricingList.length > 0 ? pricingList[0].quality : "", contactNumber: "" });
      setImages({ image1: null, image2: null });
      e.target.reset();
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bulk-order-container" style={{ backgroundImage: "url('/images/bulk_order_bg.png')" }}>
      <div className="bulk-order-card stack-md">
        <h2>Request a Bulk Order</h2>
        <p className="bulk-order-subtext">Get custom t-shirts in bulk with your amazing designs.</p>
        
        {msg && <div className="bulk-order-msg success">{msg}</div>}
        {err && <div className="bulk-order-msg error">{err}</div>}

        <form onSubmit={handleSubmit} className="bulk-order-form">
          <div className="form-group">
            <label><Upload size={16} /> Front Design Image</label>
            <input type="file" name="image1" accept="image/*" onChange={handleImageChange} required />
          </div>

          <div className="form-group">
            <label><Upload size={16} /> Back Design Image</label>
            <input type="file" name="image2" accept="image/*" onChange={handleImageChange} required />
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="form-group">
              <label><Ruler size={16} /> Quality (GSM)</label>
              <select name="quality" value={formData.quality} onChange={handleInputChange} required>
                {pricingList.length === 0 ? (
                  <option value="">Loading options...</option>
                ) : (
                  pricingList.map(p => (
                    <option key={p._id} value={p.quality}>{p.quality}</option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label><Package size={16} /> Quantity</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                min="1"
                required
                placeholder="e.g. 50"
              />
            </div>
          </div>

          <div className="form-group">
            <label><Phone size={16} /> Contact Number</label>
            <input
              type="tel"
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleInputChange}
              required
              placeholder="Your contact number"
            />
          </div>

          {estimatedPrice > 0 && (
             <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg border border-blue-200 dark:border-blue-800/50 mt-2">
               <div className="text-sm opacity-80 uppercase font-bold tracking-wider mb-1">Estimated Cost</div>
               <div className="text-2xl font-black">Rs. {estimatedPrice.toFixed(2)}</div>
               <div className="text-xs opacity-70 mt-1">Based on {formData.quantity} pieces of {formData.quality}</div>
             </div>
          )}

          <button type="submit" className="bulk-order-btn" disabled={loading}>
            {loading ? <Sparkles className="spin-anim" /> : <CheckCircle size={20} />}
            {loading ? "Submitting Request..." : "Confirm Bulk Request"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BulkOrderForm;
