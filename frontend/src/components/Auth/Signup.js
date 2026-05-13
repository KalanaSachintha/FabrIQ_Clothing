// src/components/Auth/Signup.js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";
import heroImg from "../../assets/auth_hero_clean.png";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const strongPwd = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    age: "",
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
    
    if (!form.name.trim()) return setErr("Name is required");
    if (!emailRe.test(form.email)) return setErr("Enter a valid email address");
    if (!strongPwd.test(form.password)) return setErr("Password must be at least 6 characters with letters and numbers");
    if (form.password !== form.confirm) return setErr("Passwords do not match");
    if (!form.agree) return setErr("Please accept the Terms & Privacy Policy");

    try {
      setBusy(true);
      await signup({
        name: form.name,
        email: form.email,
        password: form.password,
        age: form.age ? Number(form.age) : undefined,
        address: form.address || undefined,
      });
      navigate("/dashboard?tab=orders");
    } catch (ex) {
      setErr(ex.message || "Signup failed. Please try again.");
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
          <img src={heroImg} alt="FabrIQ Lifestyle" className="auth-hero-img" />
          <div className="auth-hero-overlay" />
          <div className="auth-hero-content">
            <h2>Craft Your Identity.</h2>
            <p>Be the first to experience our exclusive drops and enjoy personalized fashion recommendations.</p>
          </div>
        </section>

        {/* Right side: Signup Form */}
        <section className="auth-form-section" style={{ overflowY: 'auto' }}>
          <div className="auth-form-wrapper" style={{ marginBlock: '40px' }}>
            <div className="auth-brand">
              <div className="auth-brand-icon">F</div>
              <span>FabrIQ</span>
            </div>

            <div className="auth-header">
              <h1>Create Account</h1>
              <p>Join the world of premium fashion today.</p>
            </div>

            {err && (
              <div className="auth-alert">
                <AlertCircle size={20} />
                <span>{err}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={submit}>
              <div className="auth-input-group">
                <label className="auth-label" htmlFor="name">Full Name</label>
                <div className="auth-input-wrapper">
                  <input
                    id="name"
                    type="text"
                    className="auth-input"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={updateField("name")}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-label" htmlFor="email">Email Address</label>
                <div className="auth-input-wrapper">
                  <input
                    id="email"
                    type="email"
                    className="auth-input"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={updateField("email")}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="password">Password</label>
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
                  <label className="auth-label" htmlFor="confirm">Confirm</label>
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
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="age">Age (Optional)</label>
                  <div className="auth-input-wrapper">
                    <input
                      id="age"
                      type="number"
                      className="auth-input"
                      placeholder="25"
                      value={form.age}
                      onChange={updateField("age")}
                    />
                  </div>
                </div>
                <div className="auth-input-group">
                  <label className="auth-label" htmlFor="address">Address (Optional)</label>
                  <div className="auth-input-wrapper">
                    <input
                      id="address"
                      type="text"
                      className="auth-input"
                      placeholder="City, Country"
                      value={form.address}
                      onChange={updateField("address")}
                    />
                  </div>
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
                  I agree to the <Link to="/terms" className="auth-footer-link" style={{ margin: 0 }}>Terms</Link> and <Link to="/privacy" className="auth-footer-link" style={{ margin: 0 }}>Privacy Policy</Link>.
                </label>
              </div>

              <button className="auth-submit-btn" type="submit" disabled={busy}>
                {busy ? "Creating Account..." : "Sign Up"}
              </button>
            </form>

            <div className="auth-footer">
              Already have an account? 
              <Link to="/login" className="auth-footer-link">Login</Link>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
