const Product = require("../Model/ProductModel");
const Notification = require("../Model/NotificationModel");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const collectUploadedFiles = (req) => {
  if (Array.isArray(req?.files)) {
    return req.files;
  }
  if (req?.files && typeof req.files === "object") {
    return Object.values(req.files).reduce((acc, bucket) => {
      if (Array.isArray(bucket)) {
        acc.push(...bucket);
      }
      return acc;
    }, []);
  }
  if (req?.file) {
    return [req.file];
  }
  return [];
};

const buildFileLookup = (files) => {
  return files.reduce((acc, file) => {
    if (!acc[file.fieldname]) {
      acc[file.fieldname] = [];
    }
    acc[file.fieldname].push(file);
    return acc;
  }, {});
};

const normalizeExistingUploadUrl = (raw) => {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/uploads/")) return trimmed;
  const token = "/uploads/";
  const index = trimmed.indexOf(token);
  if (index >= 0) {
    return trimmed.slice(index);
  }
  return "";
};

const parseColorVariantsPayload = (input) => {
  if (!input) return [];
  let payload = input;
  if (typeof input === "string") {
    try {
      payload = JSON.parse(input);
    } catch (_err) {
      return [];
    }
  }
  if (!Array.isArray(payload)) return [];

  return payload.map((entry) => {
    const colorName = typeof entry?.colorName === "string" ? entry.colorName.trim() : "";
    const imageKeys = Array.isArray(entry?.imageKeys)
      ? entry.imageKeys
          .map((key) => (typeof key === "string" ? key.trim() : ""))
          .filter(Boolean)
      : [];
    const existingImageUrls = Array.isArray(entry?.existingImageUrls)
      ? entry.existingImageUrls.map(normalizeExistingUploadUrl).filter(Boolean)
      : [];
    const stockAmount = Number.isFinite(Number(entry?.stockAmount))
      ? Math.max(0, Math.floor(Number(entry.stockAmount)))
      : 0;
    const availableSizesInput = Array.isArray(entry?.availableSizes)
      ? entry.availableSizes
          .map((value) => (typeof value === "string" ? value.trim().toUpperCase() : ""))
          .filter(Boolean)
      : [];

  const sizeStocks = [];
    const sizeSeen = new Set();
  const sizeStocksProvided = Array.isArray(entry?.sizeStocks) || (!!entry?.sizeStocks && typeof entry.sizeStocks === "object");
    const registerSizeStock = (sizeValue, stockValue) => {
      const rawLabel = typeof sizeValue === "string" ? sizeValue.trim() : "";
      if (!rawLabel) return;
      const label = rawLabel.toUpperCase();
      if (sizeSeen.has(label)) return;
      const numeric = Number(stockValue);
      const normalizedStock = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : Math.max(0, Math.floor(numeric || 0));
      sizeSeen.add(label);
      sizeStocks.push({ size: label, stockAmount: normalizedStock });
    };

    if (Array.isArray(entry?.sizeStocks)) {
      entry.sizeStocks.forEach((item) => {
        if (!item || typeof item !== "object") return;
        registerSizeStock(item.size, item.stockAmount ?? item.stock ?? 0);
      });
    } else if (entry?.sizeStocks && typeof entry.sizeStocks === "object") {
      Object.entries(entry.sizeStocks).forEach(([sizeKey, value]) => {
        registerSizeStock(sizeKey, value);
      });
    }

    const mergedSizes = Array.from(new Set([...availableSizesInput, ...sizeStocks.map((item) => item.size)]));

    return {
      colorName,
      imageKeys,
      existingImageUrls,
      stockAmount,
      availableSizes: mergedSizes,
      sizeStocks,
      sizeStocksProvided,
    };
  });
};

const buildColorVariantModels = (variantPayload, fileLookup) => {
  const colorVariants = [];
  const galleryImageUrls = [];
  const availableColors = [];
  const seenColours = new Set();
  let totalStock = 0;

  for (const variant of variantPayload) {
    const colourLabel = variant.colorName;
    if (!colourLabel) {
      return { error: "Every colour entry needs a name" };
    }

    const colourKey = colourLabel.toLowerCase();
    if (seenColours.has(colourKey)) {
      return { error: `Duplicate colour "${colourLabel}" found. Use unique colour names.` };
    }
    seenColours.add(colourKey);

    const uploadedImageUrls = variant.imageKeys.flatMap((key) => {
      const bucket = fileLookup?.[key];
      if (!Array.isArray(bucket) || !bucket.length) return [];
      return bucket.map((file) => `/uploads/${file.filename}`);
    });

    const merged = [...variant.existingImageUrls, ...uploadedImageUrls].filter(Boolean);
    const uniqueImages = Array.from(new Set(merged));

    if (!uniqueImages.length) {
      return { error: `Colour "${colourLabel}" must include at least one image` };
    }

    const sizeStockEntries = [];
    const seenSizeLabels = new Set();
    if (Array.isArray(variant.sizeStocks)) {
      variant.sizeStocks.forEach((item) => {
        if (!item || typeof item !== "object") return;
        const rawLabel = typeof item.size === "string" ? item.size.trim() : "";
        if (!rawLabel) return;
        const label = rawLabel.toUpperCase();
        if (seenSizeLabels.has(label)) return;
        const numeric = Number(item.stockAmount ?? item.stock ?? 0);
        const normalizedStock = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : Math.max(0, Math.floor(numeric || 0));
        seenSizeLabels.add(label);
        sizeStockEntries.push({ size: label, stockAmount: normalizedStock });
      });
    }

    const availableSizes = Array.isArray(variant.availableSizes)
      ? variant.availableSizes
          .map((value) => (typeof value === "string" ? value.trim().toUpperCase() : ""))
          .filter(Boolean)
      : [];

    const mergedSizes = Array.from(new Set([...availableSizes, ...sizeStockEntries.map((item) => item.size)]));

    const stockAmount = sizeStockEntries.length
      ? sizeStockEntries.reduce((sum, item) => sum + item.stockAmount, 0)
      : Number.isFinite(Number(variant.stockAmount))
      ? Math.max(0, Math.floor(Number(variant.stockAmount)))
      : 0;

    colorVariants.push({
      colorName: colourLabel,
      imageUrls: uniqueImages,
      stockAmount,
      availableSizes: mergedSizes,
      sizeStocks: sizeStockEntries,
    });
    availableColors.push(colourLabel);
    galleryImageUrls.push(...uniqueImages);
    totalStock += stockAmount;
  }

  const uniqueGallery = Array.from(new Set(galleryImageUrls));
  const primaryImageUrl = colorVariants.length ? colorVariants[0].imageUrls[0] : "";

  return {
    colorVariants,
    galleryImageUrls: uniqueGallery,
    availableColors,
    primaryImageUrl,
    totalStock,
  };
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const isPastDate = (value) => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const parseBooleanInput = (value) => {
  if (typeof value === "undefined") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return undefined;
};

const coerceBoolean = (value, fallback = false) => {
  const parsed = parseBooleanInput(value);
  return typeof parsed === "undefined" ? fallback : parsed;
};

const parseOptionalDate = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const normalizeReminderDays = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return Math.max(0, Math.floor(fallback || 0));
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.max(0, Math.floor(numeric));
};

const formatExpiryMessageDate = (date) => {
  try {
    return date.toLocaleDateString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    return date.toISOString().slice(0, 10);
  }
};

const maybeTriggerExpiryNotification = async (product) => {
  try {
    if (!product || !product.expireTrackingEnabled) return;

    const expiryDate = product.expiryDate ? new Date(product.expiryDate) : null;
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) return;

    const reminderDays = Math.max(0, Number(product.expiryReminderDays ?? 0));
    const diffMs = expiryDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / DAY_IN_MS);

    if (diffDays > reminderDays) {
      return;
    }

    if (product.expiryNotificationSentAt) {
      return;
    }

    const claimTimestamp = new Date();
    const claimResult = await Product.updateOne(
      {
        _id: product._id,
        $or: [
          { expiryNotificationSentAt: { $exists: false } },
          { expiryNotificationSentAt: null },
        ],
      },
      { expiryNotificationSentAt: claimTimestamp }
    );

    if (!claimResult || !claimResult.modifiedCount) {
      return;
    }

    let existingNotification = null;
    if (product.lastExpiryNotificationId) {
      existingNotification = await Notification.findById(product.lastExpiryNotificationId).lean();
    }
    if (!existingNotification) {
      existingNotification = await Notification.findOne({
        type: "inventory-expiry",
        "metadata.productId": product._id,
        status: "unread",
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (existingNotification) {
      await Product.updateOne(
        { _id: product._id },
        {
          expiryNotificationSentAt: existingNotification.createdAt || claimTimestamp,
          lastExpiryNotificationId: existingNotification._id,
        }
      );
      return;
    }

    const formattedDate = formatExpiryMessageDate(expiryDate);
    let notification;
    try {
      notification = await Notification.create({
        recipientRole: "admin",
        title: "Product expiring soon",
        message: `${product.name || "A product"} will expire on ${formattedDate}.`,
        type: "inventory-expiry",
        metadata: {
          productId: product._id,
          expiryDate: expiryDate.toISOString(),
          reminderDays,
        },
      });
    } catch (creationError) {
      await Product.updateOne(
        { _id: product._id },
        { expiryNotificationSentAt: null, lastExpiryNotificationId: undefined }
      );
      throw creationError;
    }

    await Product.updateOne(
      { _id: product._id },
      {
        expiryNotificationSentAt: notification.createdAt,
        lastExpiryNotificationId: notification._id,
      }
    );
  } catch (error) {
    console.error("Expiry notification dispatch failed:", error);
  }
};

const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    await Promise.allSettled(products.map((product) => maybeTriggerExpiryNotification(product)));
    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching products", error });
  }
};

const getProductCategories = async (_req, res) => {
  try {
    const categories = await Product.distinct("category");
    const normalized = categories
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => item.trim())
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return res.status(200).json(normalized);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching categories", error });
  }
};

// GET by ID
const getbyId = async (req, res) => {
  try {
    const product = await Product.findById(req.params.pid);
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.status(200).json(product);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching product", error });
  }
};

const addProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      description,
      category,
      brand,
      gender,
      inStock,
      stockAmount,
      supplierId,
      supplierProductId,
      expireTrackingEnabled,
      expiryDate,
      expiryReminderDays,
      colorVariants: rawColorVariants,
    } = req.body;

    const uploadedFiles = collectUploadedFiles(req);
    const fileLookup = buildFileLookup(uploadedFiles);
    const variantPayload = parseColorVariantsPayload(rawColorVariants);

    if (!variantPayload.length) {
      return res.status(400).json({ message: "Provide at least one colour" });
    }

    const variantBuild = buildColorVariantModels(variantPayload, fileLookup);
    if (variantBuild?.error) {
      return res.status(400).json({ message: variantBuild.error });
    }

    const { colorVariants, galleryImageUrls, availableColors, primaryImageUrl, totalStock } = variantBuild;
    if (!primaryImageUrl) {
      return res.status(400).json({ message: "At least one product image is required" });
    }

    const derivedInStock = totalStock > 0;
    const inStockFlag = coerceBoolean(inStock, derivedInStock);
    const normalizedStock = Number.isFinite(totalStock) ? Math.max(0, Math.floor(totalStock)) : 0;

    const trackingEnabled = coerceBoolean(expireTrackingEnabled, false);
    const parsedExpiryDate = trackingEnabled ? parseOptionalDate(expiryDate) : null;
    if (trackingEnabled && !parsedExpiryDate) {
      return res.status(400).json({ message: "Invalid expiry date provided" });
    }

    if (trackingEnabled && isPastDate(parsedExpiryDate)) {
      return res.status(400).json({ message: "Expiry date cannot be in the past" });
    }

    const parsedReminderDays = trackingEnabled
      ? normalizeReminderDays(expiryReminderDays, 0)
      : undefined;
    if (trackingEnabled && parsedReminderDays === null) {
      return res.status(400).json({ message: "Invalid expiry reminder days" });
    }

    const product = new Product({
      name,
      price,
      description,
      category,
      brand,
      gender,
      inStock: inStockFlag,
  stockAmount: normalizedStock,
      imageUrl: primaryImageUrl,
      galleryImageUrls,
      colorVariants,
      ...(supplierId ? { supplierId } : {}),
      ...(supplierProductId ? { supplierProductId } : {}),
      expireTrackingEnabled: trackingEnabled,
      expiryDate: trackingEnabled ? parsedExpiryDate : undefined,
      expiryReminderDays: trackingEnabled ? parsedReminderDays ?? 0 : undefined,
      expiryNotificationSentAt: null,
      lastExpiryNotificationId: undefined,
      availableColors,
    });

    await product.save();
    await maybeTriggerExpiryNotification(product);
    const freshProduct = await Product.findById(product._id);

    return res
      .status(201)
      .json({ message: "Product added successfully", product: freshProduct || product });
  } catch (error) {
    return res.status(400).json({ message: "Error adding product", error });
  }
};

//update
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.pid);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const {
      name,
      price,
      description,
      category,
      brand,
      gender,
      inStock,
      stockAmount,
      supplierId,
      supplierProductId,
      expireTrackingEnabled,
      expiryDate,
      expiryReminderDays,
      colorVariants: rawColorVariants,
    } = req.body;

  const uploadedFiles = collectUploadedFiles(req);
  const fileLookup = buildFileLookup(uploadedFiles);
  const hasVariantPayload = typeof rawColorVariants !== "undefined";
  const parsedVariantPayload = parseColorVariantsPayload(rawColorVariants);

    const originalTracking = Boolean(product.expireTrackingEnabled);
    const originalExpiryDate = product.expiryDate ? new Date(product.expiryDate) : null;
    const originalReminderDays = Number(product.expiryReminderDays ?? 0);

    if (typeof name !== "undefined") product.name = name;
    if (typeof price !== "undefined") product.price = price;
    if (typeof description !== "undefined") product.description = description;
    if (typeof category !== "undefined") product.category = category;
    if (typeof brand !== "undefined") product.brand = brand;
    if (typeof gender !== "undefined") product.gender = gender;

    let inStockFlag = product.inStock;
    const inStockProvided = typeof inStock !== "undefined";
    if (inStockProvided) {
      inStockFlag = coerceBoolean(inStock, product.inStock);
      product.inStock = inStockFlag;
    }

    const stockProvided = typeof stockAmount !== "undefined";
    if (stockProvided) {
      const numericStock = Number(stockAmount);
      if (Number.isFinite(numericStock) && numericStock >= 0) {
        product.stockAmount = inStockFlag ? Math.max(0, Math.floor(numericStock)) : 0;
      } else if (inStockFlag) {
        return res.status(400).json({ message: "Invalid stock amount" });
      } else {
        product.stockAmount = 0;
      }
    } else if (!inStockFlag) {
      product.stockAmount = 0;
    }

    if (supplierId === null || supplierId === "") {
      product.supplierId = undefined;
    } else if (typeof supplierId !== "undefined") {
      product.supplierId = supplierId;
    }

    if (supplierProductId === null || supplierProductId === "") {
      product.supplierProductId = undefined;
    } else if (typeof supplierProductId !== "undefined") {
      product.supplierProductId = supplierProductId;
    }

    if (hasVariantPayload) {
      if (!parsedVariantPayload.length) {
        return res.status(400).json({ message: "Provide at least one colour" });
      }
      let variantPayload = parsedVariantPayload;
      const existingVariants = Array.isArray(product.colorVariants) ? product.colorVariants : [];
      if (existingVariants.length) {
        const existingVariantMap = new Map();
        existingVariants.forEach((variant) => {
          const key = typeof variant?.colorName === "string" ? variant.colorName.trim().toLowerCase() : "";
          if (!key || existingVariantMap.has(key)) return;
          existingVariantMap.set(key, variant);
        });

        variantPayload = parsedVariantPayload.map((variant) => {
          const { sizeStocksProvided, ...rest } = variant;
          const key = typeof rest?.colorName === "string" ? rest.colorName.trim().toLowerCase() : "";
          if (
            key &&
            !sizeStocksProvided &&
            (!Array.isArray(rest.sizeStocks) || !rest.sizeStocks.length) &&
            existingVariantMap.has(key)
          ) {
            const existing = existingVariantMap.get(key);
            const normalizedExisting = Array.isArray(existing?.sizeStocks)
              ? existing.sizeStocks
                  .map((item) => {
                    if (!item || typeof item !== "object") return null;
                    const label = typeof item.size === "string" ? item.size.trim().toUpperCase() : "";
                    if (!label) return null;
                    const numeric = Number(item.stockAmount ?? item.stock ?? 0);
                    const normalizedStock = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : Math.max(0, Math.floor(numeric || 0));
                    return { size: label, stockAmount: normalizedStock };
                  })
                  .filter(Boolean)
              : [];
            if (normalizedExisting.length) {
              return { ...rest, sizeStocks: normalizedExisting };
            }
          }
          return rest;
        });
      }

      const variantBuild = buildColorVariantModels(variantPayload, fileLookup);
      if (variantBuild?.error) {
        return res.status(400).json({ message: variantBuild.error });
      }
      product.colorVariants = variantBuild.colorVariants;
      product.availableColors = variantBuild.availableColors;
      product.galleryImageUrls = variantBuild.galleryImageUrls;
      const totalVariantStock = Number.isFinite(variantBuild.totalStock)
        ? Math.max(0, Math.floor(variantBuild.totalStock))
        : 0;
      product.stockAmount = totalVariantStock;
      if (!inStockProvided) {
        product.inStock = totalVariantStock > 0;
      }

      if (variantBuild.primaryImageUrl) {
        product.imageUrl = variantBuild.primaryImageUrl;
      }
    } else if (uploadedFiles.length) {
      const fallbackUrls = uploadedFiles.map((file) => `/uploads/${file.filename}`);
      if (fallbackUrls.length) {
        product.imageUrl = fallbackUrls[0];
        const mergedGallery = Array.from(new Set([...(product.galleryImageUrls || []), ...fallbackUrls]));
        product.galleryImageUrls = mergedGallery;
      }
    }

    const trackingProvided = typeof expireTrackingEnabled !== "undefined";
    let trackingFlag = product.expireTrackingEnabled;
    if (trackingProvided) {
      trackingFlag = coerceBoolean(expireTrackingEnabled, product.expireTrackingEnabled);
      product.expireTrackingEnabled = trackingFlag;
    }

    const dateProvided = typeof expiryDate !== "undefined";
    const reminderProvided = typeof expiryReminderDays !== "undefined";

    if (!product.expireTrackingEnabled) {
      if (trackingProvided) {
        product.expiryDate = undefined;
        product.expiryReminderDays = undefined;
        product.expiryNotificationSentAt = undefined;
        product.lastExpiryNotificationId = undefined;
      }
    } else {
      const parsedExpiryDate = dateProvided
        ? parseOptionalDate(expiryDate)
        : product.expiryDate
        ? new Date(product.expiryDate)
        : null;
      if (dateProvided && !parsedExpiryDate) {
        return res.status(400).json({ message: "Invalid expiry date provided" });
      }

      if (trackingFlag && parsedExpiryDate && isPastDate(parsedExpiryDate)) {
        return res.status(400).json({ message: "Expiry date cannot be in the past" });
      }

      const nextReminder = reminderProvided
        ? normalizeReminderDays(expiryReminderDays, 0)
        : product.expiryReminderDays ?? 0;
      if (reminderProvided && nextReminder === null) {
        return res.status(400).json({ message: "Invalid expiry reminder days" });
      }

      if (!parsedExpiryDate) {
        return res.status(400).json({ message: "Expiry date is required when tracking is enabled" });
      }

  product.expiryDate = parsedExpiryDate;
      product.expiryReminderDays = nextReminder;

      const reminderDays = Math.max(0, Number(product.expiryReminderDays ?? 0));
      const expiryDateValue = new Date(product.expiryDate);
      const diffDays = Math.ceil((expiryDateValue.getTime() - Date.now()) / DAY_IN_MS);

      const trackingJustEnabled = !originalTracking && product.expireTrackingEnabled;
      const expiryChanged =
        dateProvided &&
        ((originalExpiryDate && parsedExpiryDate && parsedExpiryDate.getTime() !== originalExpiryDate.getTime()) ||
          (!originalExpiryDate && parsedExpiryDate));
      const reminderChanged = reminderProvided && nextReminder !== originalReminderDays;

      if (trackingJustEnabled || expiryChanged || reminderChanged) {
        product.expiryNotificationSentAt = null;
        product.lastExpiryNotificationId = undefined;
      }

      if (diffDays > reminderDays) {
        product.expiryNotificationSentAt = null;
        product.lastExpiryNotificationId = undefined;
      }
    }

  if (!product.galleryImageUrls || !product.galleryImageUrls.length) {
    product.galleryImageUrls = [product.imageUrl].filter(Boolean);
  }

  await product.save({ runValidators: true });
  await maybeTriggerExpiryNotification(product);
  const freshProduct = await Product.findById(product._id);

  return res.status(200).json({ message: "Product updated successfully", product: freshProduct || product });
  } catch (error) {
    return res.status(500).json({ message: "Error updating product", error });
  }
};

//DELETE
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.pid);
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting product", error });
  }
};

module.exports = {
  getAllProducts,
  getProductCategories,
  addProduct,
  getbyId,
  updateProduct,
  deleteProduct,
  upload,
};
