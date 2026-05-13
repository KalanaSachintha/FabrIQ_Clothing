// controllers/orderController.js
const mongoose = require("mongoose");
const Order = require("../Model/orderModel");
const Payment = require("../Model/paymentModel");
const Product = require("../Model/ProductModel");
const UserActivity = require("../Model/UserActivityModel");

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

const normalizePaymentAmount = (amount, currency, method) => {
  if (String(method || "").toLowerCase() !== "stripe") return amount;
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return ZERO_DECIMAL_CURRENCIES.has(String(currency || "").toLowerCase())
    ? value
    : value / 100;
};

const recordActivity = async ({
  userId,
  type,
  description,
  metadata,
  actorId,
  request,
}) => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    if (!userId || !type) return;
    const payload = {
      user: userId,
      type,
      description,
      metadata: metadata || {},
    };
    if (actorId) payload.actor = actorId;
    if (request) {
      payload.ip = request.ip || request.headers["x-forwarded-for"] || request.connection?.remoteAddress;
      payload.userAgent = request.headers?.["user-agent"];
    }
    await UserActivity.create(payload);
  } catch (err) {
    console.error("recordActivity error:", err.message || err);
  }
};

/* ------------------- Get all orders ------------------- */
const getAllOrders = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const ownsOnly = ["user", "customer"].includes(role);
    const stripeOnlyFlag = String(
      req.query?.paidStripeOnly ||
      req.query?.stripePaidOnly ||
      req.query?.stripePaid ||
      ""
    ).toLowerCase();
    const requireStripePaid = stripeOnlyFlag === "true" || stripeOnlyFlag === "1";

    const filter = ownsOnly ? { userId: req.user._id } : {};

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    if (orders.length === 0) {
      return res.status(200).json({ orders: [] });
    }

    const orderIds = orders.map((order) => order._id);
    const paymentFilter = { orderId: { $in: orderIds } };
    if (ownsOnly) {
      paymentFilter.userId = req.user._id;
    }

    const payments = await Payment.find(paymentFilter).sort({ createdAt: -1 }).lean();
    const paymentMap = new Map();

    const scoreStatus = (status = "") => {
      const normalized = String(status).toLowerCase();
      if (normalized === "paid") return 3;
      if (normalized === "requires_action") return 2;
      if (normalized === "pending") return 1;
      return 0;
    };

    for (const payment of payments) {
      const key = payment.orderId?.toString();
      if (!key) continue;
      const existing = paymentMap.get(key);
      if (!existing) {
        paymentMap.set(key, payment);
        continue;
      }

      const nextScore = scoreStatus(payment.paymentStatus);
      const currentScore = scoreStatus(existing.paymentStatus);
      if (
        nextScore > currentScore ||
        (nextScore === currentScore && new Date(payment.updatedAt) > new Date(existing.updatedAt))
      ) {
        paymentMap.set(key, payment);
      }
    }

    const enrichedOrders = orders.map((order) => {
      const payment = paymentMap.get(order._id.toString());
      if (!payment) return order;

      const paymentStatus = payment.paymentStatus || "pending";
      const normalizedStatus = String(paymentStatus).toLowerCase();
      const isPaid = normalizedStatus === "paid";
      const computedReceiptUrl = isPaid ? payment.receiptUrl || payment.slipUrl || null : null;

      return {
        ...order,
        paymentInfo: {
          paymentId: payment.paymentId || payment._id?.toString(),
          method: payment.method,
          paymentStatus,
          amount: normalizePaymentAmount(payment.amount, payment.currency, payment.method),
          rawAmount: payment.amount,
          currency: payment.currency,
          receiptUrl: computedReceiptUrl,
          slipUrl: payment.slipUrl || null,
          cardBrand: payment.cardBrand || null,
          cardLast4: payment.cardLast4 || null,
          updatedAt: payment.updatedAt,
          supplierId: payment.supplierId ? payment.supplierId.toString() : null,
        },
      };
    });

    const filteredOrders = requireStripePaid
      ? enrichedOrders.filter((order) => {
          const info = order.paymentInfo;
          if (!info) return false;
          const method = String(info.method || "").toLowerCase();
          const status = String(info.paymentStatus || "").toLowerCase();
          const supplierLinked = Boolean(info.supplierId);
          return method === "stripe" && status === "paid" && !supplierLinked;
        })
      : enrichedOrders;

    // ✅ Always 200; return empty array instead of 404
    return res.status(200).json({ orders: filteredOrders });
  } catch (err) {
    console.error("❌ getAllOrders error:", err);
    res.status(500).json({ message: "Error fetching orders", error: err.message });
  }
};

/* ------------------- Add a new order ------------------- */
const ALLOWED_PAYMENT_METHODS = ["Pay Online", "Pay Later", "Cash", "Card"];

// Contact must be exactly 10 digits (local phone number requirement)
const isValidContact = (c) => typeof c === "string" && /^\d{10}$/.test(c.trim());

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeVariantValue = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const buildVariantKey = (productId, color, size) => {
  const pid = String(productId || "").trim();
  const colorToken = (color || "default").toLowerCase();
  const sizeToken = (size || "default").toLowerCase();
  return `${pid}:${colorToken}:${sizeToken}`;
};

const addOrders = async (req, res) => {
  const { contact, items, paymentMethod } = req.body;

  const productRequests = new Map();
  const productCache = new Map();
  const productAdjustments = [];
  const adjustedProducts = [];
  const cartLines = [];

  try {
    if (!contact || !items || items.length === 0 || !paymentMethod) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!isValidContact(contact)) {
      return res.status(400).json({ message: "Invalid contact format" });
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    for (const item of items) {
      const rawId = item?.productId || item?._id;
      const pid = String(rawId || "").trim();

      if (!pid || !mongoose.Types.ObjectId.isValid(pid)) {
        return res.status(400).json({ message: `Invalid productId for item "${item?.productName || item?.name || "Unknown"}"` });
      }

      const quantity = Number(item?.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ message: `Invalid quantity for item "${item?.productName || item?.name || "Unknown"}"` });
      }

      const color = normalizeVariantValue(item?.color || item?.selectedColor || item?.colorName);
      const size = normalizeVariantValue(item?.size || item?.selectedSize || item?.sizeLabel);

      cartLines.push({ productId: pid, quantity, color, size });

      const current = productRequests.get(pid) || 0;
      productRequests.set(pid, current + quantity);
    }

    if (productRequests.size === 0) {
      return res.status(400).json({ message: "At least one valid product is required" });
    }

    for (const [productId, quantity] of productRequests.entries()) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(400).json({ message: "One or more products in your cart are no longer available" });
      }

      if (!Number.isFinite(product.price) || Number(product.price) < 0) {
        return res.status(400).json({ message: `Invalid price for product ${product.name}` });
      }

      if (product.stockAmount < quantity) {
        return res.status(409).json({ message: `Only ${product.stockAmount} item(s) of ${product.name} left in stock` });
      }

      productCache.set(productId, product);
      productAdjustments.push({ product, quantity });
    }

    for (const [productId, product] of productCache.entries()) {
      const relatedLines = cartLines.filter((line) => line.productId === productId);
      if (relatedLines.length === 0) continue;

      product.adjustStock(relatedLines);
      await product.save();
      adjustedProducts.push({ product, relatedLines });
    }

    const sanitizedItems = [];
    let totalAmount = 0;

    for (const line of cartLines) {
      const product = productCache.get(line.productId);
      if (!product) {
        return res.status(400).json({ message: "Unable to build order items. Please try again." });
      }
      const unitPrice = Number(product.price || 0);
      totalAmount += unitPrice * line.quantity;
      sanitizedItems.push({
        productId: product._id,
        productName: product.name,
        price: unitPrice,
        quantity: line.quantity,
        color: line.color,
        size: line.size,
      });
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: "Computed total amount is invalid" });
    }

    const newOrder = new Order({
      userId: req.user._id,
      contact,
      items: sanitizedItems,
      paymentMethod,
      totalAmount,
    });

    await newOrder.save();

    await recordActivity({
      userId: req.user._id,
      type: "custom",
      description: `Placed order #${newOrder._id} (${sanitizedItems.length} items, ${paymentMethod})`,
      metadata: {
        orderId: newOrder._id.toString(),
        paymentMethod,
        totalAmount,
        itemCount: sanitizedItems.length,
      },
      actorId: req.user._id,
      request: req,
    });

    res.status(201).json({
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (err) {
    console.error("❌ addOrders error:", err);

    if (adjustedProducts.length) {
      try {
        await Promise.all(
          adjustedProducts.map(async ({ product, relatedLines }) => {
            // Restore inventory by passing negative quantities
            const restoreLines = relatedLines.map((line) => ({
              ...line,
              quantity: -line.quantity,
            }));
            product.adjustStock(restoreLines);
            await product.save();
          })
        );
      } catch (rollbackErr) {
        console.error("❌ Failed to rollback stock adjustment:", rollbackErr);
      }
    }

    const statusCode = err && err.statusCode ? err.statusCode : 500;
    res.status(statusCode).json({ message: "Unable to add order", error: err.message || String(err) });
  }
};

/* ------------------- Get order by ID ------------------- */
const getOrderById = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      (req.user.role || "").toLowerCase() === "user" &&
      order.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    res.status(200).json({ order });
  } catch (err) {
    console.error("❌ getOrderById error:", err);
    res.status(500).json({ message: "Error fetching order", error: err.message });
  }
};

/* ------------------- Update order ------------------- */
const updateOrder = async (req, res) => {
  const { id } = req.params;
  const { contact, items, status } = req.body;
  const stockAdjustments = [];

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      (req.user.role || "").toLowerCase() === "user" &&
      order.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    if (contact) {
      if (!isValidContact(contact)) return res.status(400).json({ message: "Invalid contact format" });
      order.contact = contact;
    }

    order.status = status ?? order.status;

    if (items && items.length > 0) {
      const productCache = new Map();
      
      // Collect all product IDs needed
      const allProductIds = new Set([
        ...order.items.map(item => item.productId.toString()),
        ...items.map(item => String(item.productId || item._id).trim())
      ]);

      // Load all product docs into cache
      for (const pid of allProductIds) {
        if (!mongoose.Types.ObjectId.isValid(pid)) continue;
        const product = await Product.findById(pid);
        if (product) productCache.set(pid, product);
      }

      // 1. Prepare NEW items and compute totals
      const sanitizedItems = [];
      let nextTotalAmount = 0;
      
      const nextProductLinesMap = new Map(); // pid -> array of lines
      
      for (const item of items) {
        const rawId = item?.productId || item?._id;
        const pid = String(rawId || "").trim();
        const product = productCache.get(pid);
        if (!product) throw createHttpError(`Product no longer available`, 404);

        const quantity = Number(item.quantity) || 0;
        const color = normalizeVariantValue(item.color || item.selectedColor);
        const size = normalizeVariantValue(item.size || item.selectedSize);
        const price = Number(item.price) || Number(product.price) || 0;

        sanitizedItems.push({
          productId: product._id,
          productName: product.name,
          price,
          quantity,
          color,
          size,
        });
        nextTotalAmount += price * quantity;

        if (!nextProductLinesMap.has(pid)) nextProductLinesMap.set(pid, []);
        nextProductLinesMap.get(pid).push({ color, size, quantity });
      }

      // 2. STOCK VALIDATION: Verify if we have enough stock (current + what we'll restore - what we'll deduct)
      for (const [pid, nextLines] of nextProductLinesMap.entries()) {
        const product = productCache.get(pid);
        const oldLinesForThisProduct = order.items.filter(i => i.productId.toString() === pid);
        
        let totalNextQty = nextLines.reduce((sum, l) => sum + l.quantity, 0);
        let totalOldQty = oldLinesForThisProduct.reduce((sum, l) => sum + l.quantity, 0);
        let delta = totalNextQty - totalOldQty;

        if (delta > 0 && product.stockAmount < delta) {
          throw createHttpError(`Not enough stock for ${product.name}. Only ${product.stockAmount} available (needs ${delta} more).`, 409);
        }
      }

      // 3. APPLY CHANGES: Restore old, Deduct new
      // We'll track what we've done for rollback
      const adjustedHistory = [];

      try {
        // Restore old stock
        for (const oldItem of order.items) {
          const pid = oldItem.productId.toString();
          const product = productCache.get(pid);
          if (product) {
            product.adjustStock([{ ...oldItem, quantity: -oldItem.quantity }]);
            adjustedHistory.push({ product, line: { ...oldItem, quantity: -oldItem.quantity } });
          }
        }

        // Deduct new stock
        for (const newItem of sanitizedItems) {
          const pid = newItem.productId.toString();
          const product = productCache.get(pid);
          if (product) {
            product.adjustStock([newItem]);
            adjustedHistory.push({ product, line: newItem });
          }
        }

        // Save all products
        for (const product of productCache.values()) {
          await product.save();
        }

        order.items = sanitizedItems;
        order.totalAmount = nextTotalAmount;
      } catch (err) {
        // ROLLBACK: Invert everything we did in adjustedHistory
        for (const { product, line } of adjustedHistory) {
          product.adjustStock([{ ...line, quantity: -line.quantity }]);
        }
        for (const product of productCache.values()) {
          try { await product.save(); } catch (e) { /* silent */ }
        }
        throw err;
      }
    }

    await order.save();
    res.status(200).json({ message: "Order updated successfully", order });
  } catch (err) {
    console.error("❌ updateOrder error:", err);
    const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
    res.status(statusCode).json({
      message: statusCode === 500 ? "Error updating order" : err.message,
      error: err.message,
    });
  }
};

/* ------------------- Delete order ------------------- */
const deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      (req.user.role || "").toLowerCase() === "user" &&
      order.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden: not your order" });
    }

    await order.deleteOne();
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("❌ deleteOrder error:", err);
    res.status(500).json({ message: "Error deleting order", error: err.message });
  }
};

module.exports = {
  getAllOrders,
  addOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
};
