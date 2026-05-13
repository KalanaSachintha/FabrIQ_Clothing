// src/components/Auth/SupplierSignup.js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";
import heroImg from "../../assets/auth_hero_clean.png";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const strongPwd = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

export default function SupplierSignup() {
  const { registerSupplier } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    address: "",
    agree: false,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const updateField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!form.name.trim()) return setErr("Business name is required");
    if (!emailRe.test(form.email)) return setErr("Enter a valid work email address");
    if (!strongPwd.test(form.password)) return setErr("Password must be at least 6 characters with letters and numbers");
    if (form.password !== form.confirm) return setErr("Passwords do not match");
    if (!form.agree) return setErr("Please accept the supplier partnership terms");

    try {
      setBusy(true);
      await registerSupplier({
        name: form.name,
        email: form.email,
        password: form.password,
        address: form.address || undefined,
      });
      navigate("/SupplierDashboard");
    } catch (ex) {
      setErr(ex.message || "Failed to create supplier account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <motion.div 
        className="auth-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Left side: Hero Image */}
        <section className="auth-hero">
          <img src={heroImg} alt="Supplier Partnership" className="auth-hero-img" />
          <div className="auth-hero-overlay" />
          <div className="auth-hero-content">
            <h2>Scale Your Business.</h2>
            <p>Join the FabrIQ ecosystem and connect your collections with fashion-forward shoppers globally.</p>
          </div>
        </section>

        {/* Right side: Supplier Signup Form */}
        <section className="auth-form-section" style={{ overflowY: 'auto' }}>
          <div className="auth-form-wrapper" style={{ marginBlock: '40px' }}>
            <div className="auth-brand">
              <div className="auth-brand-icon" style={{ backgroundColor: 'var(--auth-accent)', color: 'var(--auth-bg)' }}>P</div>
              <span>FabrIQ Partners</span>
            </div>

            <div className="auth-header">
              <h1>Supplier Portal</h1>
              <p>Ready to take your brand to the next level?</p>
            </div>

            {err && (
              <div className="auth-alert">
                <AlertCircle size={20} />
                <span>{err}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={submit}>
              <div className="auth-input-group">
                <label className="auth-label" htmlFor="businessName">Business Name</label>
                <div className="auth-input-wrapper">
                  <input
                    id="businessName"
                    type="text"
                    className="auth-input"
                    placeholder="Acme Textiles Ltd."
                    value={form.name}
                    onChange={updateField("name")}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-label" htmlFor="workEmail">Work Email</label>
                <div className="auth-input-wrapper">
                  <input
                    id="workEmail"
                    type="email"
                    className="auth-input"
                    placeholder="partners@acme.com"
                    value={form.email}
                    onChange={updateField("email")}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-label" htmlFor="password">Create Password</label>
                <div className="auth-input-wrapper">
                  <input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    className="auth-input"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={updateField("password")}
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-pwd"
                    onClick={() => setShowPwd(!showPwd)}
                  >
                    {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-label" htmlFor="confirm">Confirm Password</label>
                <div className="auth-input-wrapper">
                  <input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    className="auth-input"
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={updateField("confirm")}
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-pwd"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-label" htmlFor="address">Headquarters Address</label>
                <div className="auth-input-wrapper">
                  <input
                    id="address"
                    type="text"
                    className="auth-input"
                    placeholder="123 Textile Ave, NY"
                    value={form.address}
                    onChange={updateField("address")}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginTop: '4px' }}>
                <input 
                  type="checkbox" 
                  id="agree" 
                  checked={form.agree} 
                  onChange={updateField("agree")}
                  style={{ marginTop: '5px' }}
                />
                <label htmlFor="agree" style={{ fontSize: '0.9rem', color: 'var(--auth-muted)', lineHeight: '1.5' }}>
                  I agree to the <Link to="/supplier-terms" className="auth-footer-link" style={{ margin: 0 }}>Supplier Terms</Link> and data processing policies.
                </label>
              </div>

              <button className="auth-submit-btn" type="submit" disabled={busy}>
                {busy ? "Registering Business..." : "Join as Partner"}
              </button>
            </form>

            <div className="auth-footer">
              Already have a partner account? 
              <Link to="/login" className="auth-footer-link">Login</Link>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
