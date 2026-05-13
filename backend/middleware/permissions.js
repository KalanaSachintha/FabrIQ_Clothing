// Backend/middleware/permissions.js
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../Model/UserModel");
const Role = require("../Model/RoleModel");
const { permsForRole } = require("./auth");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const { requireAuth, permsForRole: getPermsForRole } = require("./auth");

/* ------------------------ Require specific permission ------------------------ */
function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // ✅ Admins always bypass permission checks (Superuser)
    const role = String(req.user.role || "").toLowerCase();
    if (role === "admin") {
      return next();
    }

    const userPerms = new Set((req.userPerms || []).map(p => String(p).toLowerCase()));
    const allowed = perms.some((p) => userPerms.has(String(p).toLowerCase()));
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

/* ----------------------------- Require admin role ---------------------------- */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if ((req.user.role || "").toLowerCase() !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
}

module.exports = { requireAuth, requirePermission, requireAdmin, getPermsForRole };
