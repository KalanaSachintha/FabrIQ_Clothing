// src/components/Auth/Login.js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Chrome, Apple, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";
import heroImg from "../../assets/auth_hero_clean.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!form.email || !form.password) {
      return setErr("Please fill in all fields");
    }

    try {
      setBusy(true);
      const { token } = await login(form.email, form.password);
      if (token) {
        localStorage.setItem("token", token);
      }
      navigate("/", { replace: true });
    } catch (ex) {
      setErr(ex.message || "Invalid credentials. Please try again.");
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
          <img src={heroImg} alt="FabrIQ Fashion" className="auth-hero-img" />
          <div className="auth-hero-overlay" />
          <div className="auth-hero-content">
            <h2>Elegance in Every Fiber.</h2>
            <p>Join the FabrIQ community and redefine your personal style with our curated collections.</p>
          </div>
        </section>

        {/* Right side: Login Form */}
        <section className="auth-form-section">
          <div className="auth-form-wrapper">
            {/* Brand Logo */}
            <div className="auth-brand">
              <div className="auth-brand-icon">F</div>
              <span>FabrIQ</span>
            </div>

            <div className="auth-header">
              <h1>Welcome Back</h1>
              <p>Enter your credentials to access your account.</p>
            </div>

            {err && (
              <div className="auth-alert">
                <AlertCircle size={20} />
                <span>{err}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={submit}>
              <div className="auth-input-group">
                <label className="auth-label" htmlFor="email">Email Address</label>
                <div className="auth-input-wrapper">
                  <input
                    id="email"
                    type="email"
                    className="auth-input"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <div className="auth-label-row">
                  <label className="auth-label" htmlFor="password">Password</label>
                  <Link to="/forgot-password" size={14} className="auth-forgot-link">Forgot password?</Link>
                </div>
                <div className="auth-input-wrapper">
                  <input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    className="auth-input"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-pwd"
                    onClick={() => setShowPwd(!showPwd)}
                  >
                    {showPwd ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>
              </div>

              <button className="auth-submit-btn" type="submit" disabled={busy}>
                {busy ? "Signing in..." : "Login"}
              </button>
            </form>

            <div className="auth-divider">OR</div>

            <div className="auth-social-btns">
              <button className="auth-social-btn" type="button">
                <Chrome size={22} />
                <span>Sign in with Google</span>
              </button>
              <button className="auth-social-btn" type="button">
                <Apple size={22} />
                <span>Sign in with Apple</span>
              </button>
            </div>

            <div className="auth-footer">
              Don't have an account? 
              <Link to="/register" className="auth-footer-link">Sign up now</Link>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
