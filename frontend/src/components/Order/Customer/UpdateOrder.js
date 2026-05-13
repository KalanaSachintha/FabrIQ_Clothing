import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "./UpdateOrder.css";
import { formatLKR } from "../../../utils/currency";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const getStoredToken = () => {
  try {
    return localStorage.getItem("token") || sessionStorage.getItem("token");
  } catch (error) {
    try {
      return sessionStorage.getItem("token");
    } catch {
      return null;
    }
  }
};

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

const normalizeSizeLabel = (value) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.toUpperCase() : "";
};

const orderSizes = (sizes) => {
  if (!Array.isArray(sizes)) return [];
  const seen = new Set();
  const cleaned = [];
  sizes.forEach((value) => {
    const label = normalizeSizeLabel(value);
    if (!label || seen.has(label)) return;
    seen.add(label);
    cleaned.push(label);
  });
  const standard = SIZE_ORDER.filter((size) => seen.has(size));
  const extras = cleaned.filter((size) => !SIZE_ORDER.includes(size));
  return [...standard, ...extras];
};

const toSizeStockMap = (input) => {
  const map = {};
  if (!input) return map;
  if (Array.isArray(input)) {
    input.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const label = normalizeSizeLabel(entry.size || entry.label);
      if (!label) return;
      const numeric = Number(entry.stockAmount ?? entry.stock ?? 0);
      map[label] = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
    });
    return map;
  }
  if (typeof input === "object") {
    Object.entries(input).forEach(([key, value]) => {
      const label = normalizeSizeLabel(key);
      if (!label) return;
      const numeric = Number(value);
      map[label] = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
    });
  }
  return map;
};

const createEmptyVariantMeta = () => ({
  colorOptions: [],
  sizeOptionsByColor: {},
  sizeStockByColor: {},
  defaultColor: null,
});

const resolveProductId = (item) => {
  if (!item) return "";
  if (typeof item.productId === "string") return item.productId;
  if (item.productId && typeof item.productId === "object" && typeof item.productId._id === "string") {
    return item.productId._id;
  }
  if (typeof item._id === "string") return item._id;
  return "";
};

const buildVariantMetadata = (product) => {
  const variants = Array.isArray(product?.colorVariants) ? product.colorVariants : [];
  if (!variants.length) return createEmptyVariantMeta();

  const colorOptions = variants
    .map((variant) => {
      const name = typeof variant?.colorName === "string" ? variant.colorName.trim() : "";
      if (!name) return null;
      const sizeStockMap = toSizeStockMap(variant?.sizeStocks);
      const declaredSizes = Array.isArray(variant?.availableSizes)
        ? variant.availableSizes.map((size) => normalizeSizeLabel(size)).filter(Boolean)
        : [];
      const mergedSizes = orderSizes([...declaredSizes, ...Object.keys(sizeStockMap)]);
      const baseStockRaw = Number(variant?.stockAmount ?? 0);
      const baseStock = Number.isFinite(baseStockRaw) ? Math.max(0, Math.floor(baseStockRaw)) : 0;
      const totalStock = Object.keys(sizeStockMap).length
        ? Object.values(sizeStockMap).reduce((sum, qty) => sum + qty, 0)
        : baseStock;
      return {
        name,
        sizes: mergedSizes,
        sizeStockMap,
        totalStock,
      };
    })
    .filter(Boolean);

  if (!colorOptions.length) return createEmptyVariantMeta();

  const sizeOptionsByColor = {};
  const sizeStockByColor = {};
  colorOptions.forEach((option) => {
    const key = option.name.toLowerCase();
    sizeOptionsByColor[key] = option.sizes;
    sizeStockByColor[key] = option.sizeStockMap;
  });

  return {
    colorOptions,
    sizeOptionsByColor,
    sizeStockByColor,
    defaultColor:
      colorOptions.find((option) => option.totalStock > 0)?.name || colorOptions[0].name,
  };
};

const selectFallbackSize = (sizes = [], stockMap = {}) => {
  if (!Array.isArray(sizes) || !sizes.length) return null;
  const availableOption = sizes.find((size) => {
    const key = normalizeSizeLabel(size);
    const qty = stockMap[key];
    return typeof qty === "number" ? qty > 0 : true;
  });
  return availableOption || sizes[0];
};

const describeVariantStatus = (item, metadata) => {
  if (!metadata || !metadata.colorOptions.length) return null;
  const colorName = item.color || metadata.defaultColor;
  if (!colorName) return null;
  const colorOption = metadata.colorOptions.find((option) => option.name === colorName);
  if (!colorOption) {
    return { type: "warning", message: "This color is no longer available." };
  }

  if (!colorOption.sizes.length) {
    if (colorOption.totalStock <= 0) {
      return { type: "warning", message: `${colorOption.name} is currently unavailable.` };
    }
    return {
      type: "info",
      message: `${colorOption.totalStock} unit${colorOption.totalStock === 1 ? "" : "s"} available in ${colorOption.name}.`,
    };
  }

  if (!item.size) {
    return { type: "warning", message: "Select a size to continue." };
  }

  const normalizedSize = normalizeSizeLabel(item.size);
  const hasSize = colorOption.sizes.some((size) => normalizeSizeLabel(size) === normalizedSize);
  if (!hasSize) {
    return {
      type: "warning",
      message: `${item.size} is no longer available in ${colorOption.name}.`,
    };
  }

  const qty = colorOption.sizeStockMap[normalizedSize];
  if (typeof qty === "number") {
    if (qty <= 0) {
      return {
        type: "warning",
        message: `${colorOption.name} / ${item.size} is currently unavailable.`,
      };
    }
    return {
      type: "info",
      message: `${qty} available for ${colorOption.name} / ${item.size}.`,
    };
  }

  return { type: "info", message: `${colorOption.name} / ${item.size}` };
};

function UpdateOrder() {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [variantMeta, setVariantMeta] = useState({});
  const [variantLoading, setVariantLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    let cancelled = false;

    const fetchOrder = async () => {
      const token = getStoredToken();
      if (!token) {
        console.warn("Missing auth token; redirecting to orders list");
        navigate("/CustomerOrders", { replace: true });
        return;
      }

      try {
        const response = await axios.get(`${API_ROOT}/api/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          setOrder(response.data.order || null);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching order:", err);
          setError("Unable to load order. It may no longer be available.");
          setOrder(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchOrder();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!order?.items?.length) return;
    const uniqueIds = Array.from(
      new Set(order.items.map((item) => resolveProductId(item)).filter(Boolean))
    );
    const missing = uniqueIds.filter(
      (pid) => !Object.prototype.hasOwnProperty.call(variantMeta, pid)
    );
    if (!missing.length) return;

    let cancelled = false;

    const fetchVariants = async () => {
      setVariantLoading(true);
      try {
        const responses = await Promise.allSettled(
          missing.map((pid) =>
            axios.get(`${API_ROOT}/products/${pid}`).then((res) => res.data)
          )
        );
        if (cancelled) return;
        setVariantMeta((prev) => {
          const next = { ...prev };
          responses.forEach((result, index) => {
            const pid = missing[index];
            if (result.status === "fulfilled" && result.value) {
              next[pid] = buildVariantMetadata(result.value);
            } else {
              console.warn("Unable to load variant data", pid, result.reason || result.value);
              next[pid] = createEmptyVariantMeta();
            }
          });
          return next;
        });
      } finally {
        if (!cancelled) {
          setVariantLoading(false);
        }
      }
    };

    fetchVariants();
    return () => {
      cancelled = true;
    };
  }, [order?.items, variantMeta]);

  useEffect(() => {
    if (!order?.items?.length) return;
    if (!Object.keys(variantMeta).length) return;

    setOrder((current) => {
      if (!current?.items?.length) return current;
      let mutated = false;
      const nextItems = current.items.map((item) => {
        const productId = resolveProductId(item);
        const metadata = productId ? variantMeta[productId] : null;
        if (!metadata || !metadata.colorOptions.length) return item;

        const colorExists = item.color
          ? metadata.colorOptions.some((option) => option.name === item.color)
          : false;

        const fallbackColor =
          metadata.colorOptions.find((option) => option.totalStock > 0)?.name ||
          metadata.colorOptions[0].name;
        const nextColor = colorExists ? item.color : fallbackColor;

        const colorKey = nextColor ? nextColor.toLowerCase() : null;
        const sizeOptions = colorKey ? metadata.sizeOptionsByColor[colorKey] || [] : [];
        let nextSize = item.size;

        if (sizeOptions.length) {
          const normalizedSize = normalizeSizeLabel(nextSize);
          const hasSize = normalizedSize
            ? sizeOptions.some((size) => normalizeSizeLabel(size) === normalizedSize)
            : false;
          if (!hasSize) {
            nextSize = selectFallbackSize(
              sizeOptions,
              metadata.sizeStockByColor[colorKey] || {}
            );
          }
        } else {
          nextSize = null;
        }

        if (nextColor !== item.color || nextSize !== item.size) {
          mutated = true;
          return { ...item, color: nextColor || null, size: nextSize || null };
        }
        return item;
      });

      return mutated ? { ...current, items: nextItems } : current;
    });
  }, [variantMeta, order?.items?.length]);

  const handleChangeItemQty = (index, value) => {
    const numeric = Number(value);
    const safeValue = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 1;
    setOrder((current) => {
      if (!current) return current;
      const items = [...current.items];
      items[index] = { ...items[index], quantity: safeValue };
      return { ...current, items };
    });
  };

  const handleChangeItemColor = (index, value) => {
    setOrder((current) => {
      if (!current) return current;
      const items = [...current.items];
      const target = items[index];
      if (!target) return current;

      const productId = resolveProductId(target);
      const metadata = productId ? variantMeta[productId] : null;
      const options = metadata?.colorOptions || [];
      if (!options.length) {
        items[index] = { ...target, color: value || null };
        return { ...current, items };
      }

      let nextColor = value || "";
      const valid = options.some((option) => option.name === nextColor);
      if (!valid) {
        nextColor =
          options.find((option) => option.totalStock > 0)?.name || options[0].name;
      }

      const colorKey = nextColor ? nextColor.toLowerCase() : null;
      const sizeOptions = colorKey ? metadata.sizeOptionsByColor[colorKey] || [] : [];
      let nextSize = target.size;

      if (sizeOptions.length) {
        const normalizedSize = normalizeSizeLabel(nextSize);
        const hasSize = normalizedSize
          ? sizeOptions.some((size) => normalizeSizeLabel(size) === normalizedSize)
          : false;
        if (!hasSize) {
          nextSize = selectFallbackSize(
            sizeOptions,
            metadata.sizeStockByColor[colorKey] || {}
          );
        }
      } else {
        nextSize = null;
      }

      items[index] = { ...target, color: nextColor || null, size: nextSize || null };
      return { ...current, items };
    });
  };

  const handleChangeItemSize = (index, value) => {
    setOrder((current) => {
      if (!current) return current;
      const items = [...current.items];
      const target = items[index];
      if (!target) return current;

      const productId = resolveProductId(target);
      const metadata = productId ? variantMeta[productId] : null;
      const colorKey = target.color ? target.color.toLowerCase() : null;
      const sizeOptions = colorKey ? metadata?.sizeOptionsByColor[colorKey] || [] : [];
      const normalizedValue = normalizeSizeLabel(value);
      const valid =
        sizeOptions.length &&
        sizeOptions.some((size) => normalizeSizeLabel(size) === normalizedValue);

      items[index] = { ...target, size: valid ? value : null };
      return { ...current, items };
    });
  };

  const sendRequest = async () => {
    if (!order) throw new Error("Order not ready");
    const token = getStoredToken();
    if (!token) throw new Error("Authentication required");

    const payload = {
      contact: String(order.contact || ""),
      items: order.items.map((item) => {
        const productId = resolveProductId(item);
        if (!productId) {
          throw new Error("Unable to resolve one of the products in this order.");
        }
        return {
          productId,
          productName: item.productName,
          quantity: Number(item.quantity),
          price: Number(item.price),
          color: item.color || null,
          size: item.size || null,
        };
      }),
    };

    return axios.put(`${API_ROOT}/api/orders/${id}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendRequest()
      .then(() => navigate("/CustomerOrders"))
      .catch((err) => {
        console.error("Failed to update order", err);
        alert(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to update order. Please try again."
        );
      });
  };

  if (loading) {
    return (
      <div className="update-order-container">
        <p>Loading order…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="update-order-container">
        <p style={{ color: "#b91c1c" }}>{error || "Order not found."}</p>
        <button type="button" onClick={() => navigate("/CustomerOrders")}>Back to orders</button>
      </div>
    );
  }

  const computedTotal = order.items.reduce(
    (acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );

  return (
    <div className="update-order-container">
      <h1>Update Order</h1>
      <form onSubmit={handleSubmit}>
        <p><strong>Contact:</strong> {order.contact}</p>

        <p>
          <strong>Total Amount:</strong> {formatLKR(computedTotal)}
        </p>

        <p><strong>Payment Method:</strong> {order.paymentMethod || "-"}</p>

        <h3>Items:</h3>
        {order.items.map((item, index) => {
          const productId = resolveProductId(item);
          const metadata = productId ? variantMeta[productId] : null;
          const colorOptions = metadata?.colorOptions || [];
          const colorValue = item.color || "";
          const colorKey = colorValue ? colorValue.toLowerCase() : "";
          const sizeOptions = colorKey ? metadata?.sizeOptionsByColor[colorKey] || [] : [];
          const variantStatus = metadata ? describeVariantStatus(item, metadata) : null;
          const variantLoadingMessage =
            !metadata && variantLoading ? "Loading available colors and sizes…" : null;
          const variantFallbackMessage =
            !metadata && !variantLoading ? "Variant options are unavailable." : null;
          const variantSummary =
            item.color || item.size
              ? [item.color, item.size].filter(Boolean).join(" · ")
              : null;

          return (
            <div key={`${productId || "line"}-${index}`} className="item-block">
              <p>
                <strong>{item.productName}</strong> @ {formatLKR(item.price)}
              </p>

              <div className="quantity-field">
                <label htmlFor={`item-qty-${index}`}>Quantity</label>
                <input
                  id={`item-qty-${index}`}
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) => handleChangeItemQty(index, event.target.value)}
                />
              </div>

              {metadata ? (
                colorOptions.length ? (
                  <div className="variant-row">
                    <div className="variant-field">
                      <label htmlFor={`item-color-${index}`}>Color</label>
                      <select
                        id={`item-color-${index}`}
                        value={colorValue}
                        onChange={(event) => handleChangeItemColor(index, event.target.value)}
                        required
                      >
                        <option value="" disabled>Select a color</option>
                        {colorOptions.map((option) => (
                          <option
                            key={option.name}
                            value={option.name}
                            disabled={option.totalStock <= 0}
                          >
                            {option.name}
                            {option.totalStock <= 0 ? " (Out of stock)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {sizeOptions.length ? (
                      <div className="variant-field">
                        <label htmlFor={`item-size-${index}`}>Size</label>
                        <select
                          id={`item-size-${index}`}
                          value={item.size || ""}
                          onChange={(event) => handleChangeItemSize(index, event.target.value)}
                          required
                        >
                          <option value="" disabled>Select a size</option>
                          {sizeOptions.map((size) => {
                            const normalized = normalizeSizeLabel(size);
                            const stock = metadata.sizeStockByColor[colorKey]?.[normalized];
                            const disabled = typeof stock === "number" ? stock <= 0 : false;
                            return (
                              <option key={size} value={size} disabled={disabled}>
                                {size}
                                {typeof stock === "number" ? ` (${stock} in stock)` : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="variant-hint">This product has no color or size selections.</p>
                )
              ) : (
                <p className="variant-hint">{variantLoadingMessage || variantFallbackMessage}</p>
              )}

              {variantStatus && (
                <p
                  className={`variant-hint ${
                    variantStatus.type === "warning" ? "variant-hint--warning" : ""
                  }`}
                >
                  {variantStatus.message}
                </p>
              )}

              {variantSummary && (
                <p className="variant-hint variant-hint--muted">Selected: {variantSummary}</p>
              )}
            </div>
          );
        })}

        <button type="submit">Update Order</button>
      </form>
    </div>
  );
}

export default UpdateOrder;
