// app.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const productRouter = require("./Route/ProductRoute");
const supplierProductRouter = require("./Route/SupplierProductRoute");
const supplierDiscountRoute = require("./Route/SupplierDiscountRoute");
const userRouter = require("./Route/UserRoute");
const roleRouter = require("./Route/RoleRoute");
const orderRoute = require("./Route/orderRoute");
const adminorderRoute = require("./Route/adminOrderRoute");
const reviewRoutes = require("./Route/ReviewRoutes");
const paymentRoute = require("./Route/paymentRoute");
const notificationRoute = require("./Route/NotificationRoute");
const attendanceRoute = require("./Route/AttendanceRoute");
const receiptRoute = require("./Route/receiptRoute");
const refundRoute = require("./Route/RefundRoute");
const reportRoute = require("./Route/ReportRoute");
const cartRoute = require("./Route/CartRoute");
const adminCartRoute = require("./Route/AdminCartRoute");
const adminCancelledOrderRoute = require("./Route/adminCancelledOrderRoute");
const chatRoute = require("./Route/ChatRoute");
const loyaltyRoute = require("./Route/LoyaltyRoute");
const adminRoutes = require("./Route/adminRoutes");
const bulkOrderRoute = require("./Route/BulkOrderRoute");
const bulkPricingRoute = require("./Route/BulkPricingRoute");
const aiRoutes = require("./Route/aiRoutes");

// ✅ Stripe webhook controller
const { stripeWebhook } = require("./Controlers/paymentController");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001"], credentials: true }));

// ✅ Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ------------------ Stripe webhook (raw body required) ------------------
// This **must** be before express.json()
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, _res, next) => {
    req.rawBody = req.body; // Stripe requires raw buffer
    next();
  },
  stripeWebhook
);

// ------------------ Routes ------------------
app.use("/products", productRouter);
app.use("/supplier-products", supplierProductRouter);
app.use("/api/supplier-discounts", supplierDiscountRoute);

app.use("/users", userRouter);
app.use("/api/users", userRouter);

app.use("/roles", roleRouter);
app.use("/api/roles", roleRouter);

app.use("/api/orders", orderRoute);
app.use("/api/admin-orders", adminorderRoute);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoute);
app.use("/api/attendance", attendanceRoute);
app.use("/api/receipts", receiptRoute);
app.use("/api/refunds", refundRoute);

app.use("/api/notifications", notificationRoute);
app.use("/api/reports", reportRoute);
app.use("/api/carts", cartRoute);
app.use("/api/admin-carts", adminCartRoute);
app.use("/api/admin-cancelled-orders", adminCancelledOrderRoute);
app.use("/api/chat", chatRoute);
app.use("/api/loyalty", loyaltyRoute);
app.use("/api/admin", adminRoutes);
app.use("/api/bulk-orders", bulkOrderRoute);
app.use("/api/bulk-pricing", bulkPricingRoute);
app.use("/api/ai", aiRoutes);

// ------------------ Serve Frontend Static Files ------------------
// Serve static files from the React app
app.use(express.static(path.join(__dirname, "../frontend/build")));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get("(.*)", (req, res) => {
  // If the request starts with /api or matches other routes, it should have been caught already
  // This catch-all serves index.html for React Router to handle client-side routing
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

function sanitizeUri(raw) {
  return typeof raw === "string" ? raw.trim() : "";
}

function isPlaceholderAtlasUri(uri) {
  if (!uri) return false;
  const lower = uri.toLowerCase();
  return lower.includes("username:password") || lower.includes("cluster.mongodb.net/fabriq");
}

async function connectToMongo() {
  const atlasFromEnv = sanitizeUri(process.env.MONGODB_URI);
  const suppliedAtlasUri = !isPlaceholderAtlasUri(atlasFromEnv) && atlasFromEnv.length ? atlasFromEnv : null;

  // These are your valid Atlas URIs
  const remoteUris = [
    suppliedAtlasUri,
  ].filter(Boolean);

  const mongoCandidates = [...remoteUris];
  const failures = [];

  for (const uri of mongoCandidates) {
    try {
      const display = uri.includes("@") ? uri.split("@").pop() : uri;
      console.log(`🔗 Connecting to: ${display}`);

      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000, // Faster failure if not found
      });

      console.log("✅ MongoDB connection established");
      return true;
    } catch (err) {
      const message = err?.message || String(err);
      const display = uri.includes("@") ? uri.split("@").pop() : uri;
      failures.push({ display, message });
    }
  }

  // If we get here, everything failed
  console.error("\n❌ FATAL: COULD NOT CONNECT TO ANY DATABASE!");
  console.error("--- Error Summary ---");
  failures.forEach(f => console.error(` • ${f.display}: ${f.message}`));

  console.warn("\n⚠️  CONTINUING IN MOCK MODE (DATA WILL NOT BE SAVED TO DISK)");
  return false;
}

async function startServer() {
  const dbConnected = await connectToMongo();
  app.locals.dbConnected = dbConnected;

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (dbConnected) {
      console.log("✅ Backend is ready for connections");
    } else {
      console.log("📊 Running with mock data (database unavailable)");
    }
  });

  // ---------------- Socket.IO (real-time) ----------------
  try {
    const { Server } = require("socket.io");
    const io = new Server(server, {
      cors: {
        origin: ["http://localhost:3000"],
        methods: ["GET", "POST"],
      },
    });
    app.locals.io = io;
    io.on("connection", (socket) => {
      console.log("[socket] client connected:", socket.id);
      socket.on("disconnect", () => console.log("[socket] client disconnected:", socket.id));
    });
  } catch (err) {
    console.warn("Socket.IO not available:", err && err.message);
  }

  server.on("error", (err) => {
    console.error("Server error:", err);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("SIGINT", async () => {
    console.log("\n📴 Received SIGINT, shutting down gracefully...");
    server.close(async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
        }
      } finally {
        process.exit(0);
      }
    });
  });
}

startServer().catch((err) => {
  console.error("Failed to start backend:", err);
  process.exit(1);
});

module.exports = app;
