import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./UpdateProduct.css";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 10);
};

const getTodayInputValue = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

const toRelativeUploadPath = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/uploads/")) return trimmed;
  const token = "/uploads/";
  const index = trimmed.indexOf(token);
  if (index >= 0) {
    return trimmed.slice(index);
  }
  return "";
};

const resolveRemoteImage = (path) => {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_ROOT}${path}`;
};

const parseCoverSelection = (value) => {
  if (typeof value !== "string") return null;
  const [type, indexToken] = value.split(":");
  const index = Number(indexToken);
  if (!["new", "existing"].includes(type) || Number.isNaN(index) || index < 0) {
    return null;
  }
  return { type, index };
};

const computeCoverSelection = (variant, requested) => {
  if (!variant) return null;
  const candidate = requested ?? variant.coverSource ?? null;

  const validateCandidate = (input) => {
    const parsed = parseCoverSelection(input);
    if (!parsed) return null;
    if (parsed.type === "new") {
      return Array.isArray(variant.newImages) && variant.newImages[parsed.index]
        ? `${parsed.type}:${parsed.index}`
        : null;
    }
    return Array.isArray(variant.existingImageUrls) && variant.existingImageUrls[parsed.index]
      ? `${parsed.type}:${parsed.index}`
      : null;
  };

  const direct = validateCandidate(candidate);
  if (direct) return direct;

  if (Array.isArray(variant.newImages) && variant.newImages.length) {
    return "new:0";
  }
  if (Array.isArray(variant.existingImageUrls) && variant.existingImageUrls.length) {
    return "existing:0";
  }
  return null;
};

const moveItemToFront = (list, index) => {
  if (!Array.isArray(list) || index < 0 || index >= list.length) return Array.isArray(list) ? [...list] : [];
  const next = list.slice();
  const [selected] = next.splice(index, 1);
  next.unshift(selected);
  return next;
};

const getVariantPreviewSrc = (variant) => {
  if (!variant) return "";
  const parsed = parseCoverSelection(variant.coverSource);
  if (parsed) {
    if (parsed.type === "new") {
      const file = Array.isArray(variant.newImages) ? variant.newImages[parsed.index] : null;
      if (file && file.previewUrl) return file.previewUrl;
    } else if (parsed.type === "existing") {
      const url = Array.isArray(variant.existingImageUrls)
        ? variant.existingImageUrls[parsed.index]
        : "";
      if (url) return resolveRemoteImage(url);
    }
  }

  if (Array.isArray(variant.newImages) && variant.newImages.length) {
    const file = variant.newImages[0];
    if (file?.previewUrl) return file.previewUrl;
  }

  if (Array.isArray(variant.existingImageUrls) && variant.existingImageUrls.length) {
    return resolveRemoteImage(variant.existingImageUrls[0]);
  }

  return "";
};

const releaseVariantPreviews = (variant) => {
  if (!variant) return;
  (variant.newImages || []).forEach((file) => {
    if (file && file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
      delete file.previewUrl;
    }
  });
};

const extractFileLabel = (value) => {
  if (typeof value !== "string") return "";
  const segments = value.split("/");
  return segments.pop() || value;
};

function UpdateProduct() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    brand: "",
    gender: "Unisex",
    supplierId: "",
    supplierProductId: "",
    expireTrackingEnabled: false,
    expiryDate: "",
    expiryReminderDays: "",
  });
  const [errors, setErrors] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierErr, setSupplierErr] = useState("");
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loadingSupplierProducts, setLoadingSupplierProducts] = useState(false);
  const [supplierProductsErr, setSupplierProductsErr] = useState("");

  const variantIdRef = useRef(0);
  const colorVariantsRef = useRef([]);
  const createVariant = (overrides = {}) => {
    const base = {
      id: variantIdRef.current++,
      colorName: "",
      existingImageUrls: [],
      newImages: [],
      coverSource: null,
      inputVersion: 0,
      ...overrides,
    };
    base.coverSource = computeCoverSelection(base, base.coverSource);
    return base;
  };

  const [colorVariants, setColorVariants] = useState(() => [createVariant()]);

  const minExpiryDate = useMemo(() => getTodayInputValue(), []);

  const errorStyle = {
    color: "#b91c1c",
    fontSize: "0.85rem",
    marginTop: "4px",
  };

  const clearFieldError = (field) => {
    setErrors((prev) => {
      if (!prev || !prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const hydrateVariants = (data) => {
    if (!data) return [createVariant()];

    if (Array.isArray(data.colorVariants) && data.colorVariants.length) {
      return data.colorVariants.map((variant) => {
        const existing = Array.isArray(variant?.imageUrls)
          ? Array.from(new Set(variant.imageUrls.filter(Boolean)))
          : [];
        return createVariant({
          colorName: variant?.colorName || "",
          existingImageUrls: existing,
          coverSource: existing.length ? "existing:0" : null,
        });
      });
    }

    const available = Array.isArray(data.availableColors) ? data.availableColors.filter(Boolean) : [];
    const gallery = Array.isArray(data.galleryImageUrls)
      ? Array.from(new Set(data.galleryImageUrls.filter(Boolean)))
      : [];

    if (available.length) {
      if (gallery.length === available.length) {
        return available.map((label, index) => {
          const existing = gallery[index] ? [gallery[index]] : [];
          return createVariant({
            colorName: label,
            existingImageUrls: existing,
            coverSource: existing.length ? "existing:0" : null,
          });
        });
      }

      if (gallery.length) {
        return available.map((label, index) => {
          const existing = index === 0 ? gallery : [];
          return createVariant({
            colorName: label,
            existingImageUrls: existing,
            coverSource: existing.length ? "existing:0" : null,
          });
        });
      }

      return available.map((label) =>
        createVariant({
          colorName: label,
          coverSource: null,
        })
      );
    }

    if (gallery.length) {
      return [
        createVariant({
          colorName: "",
          existingImageUrls: gallery,
          coverSource: gallery.length ? "existing:0" : null,
        }),
      ];
    }

    if (data.imageUrl) {
      return [
        createVariant({
          colorName: "",
          existingImageUrls: [data.imageUrl],
          coverSource: "existing:0",
        }),
      ];
    }

    return [createVariant()];
  };

  useEffect(() => {
    fetch(`${API_ROOT}/products/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProduct({
          name: data.name || "",
          price: data.price || "",
          description: data.description || "",
          category: data.category || "",
          brand: data.brand || "",
          gender: data.gender || "Unisex",
          supplierId: data?.supplierId?._id || data?.supplierId || "",
          supplierProductId: data?.supplierProductId?._id || data?.supplierProductId || "",
          expireTrackingEnabled: Boolean(data?.expireTrackingEnabled),
          expiryDate: toDateInputValue(data?.expiryDate),
          expiryReminderDays:
            typeof data?.expiryReminderDays === "number" && !Number.isNaN(data.expiryReminderDays)
              ? String(data.expiryReminderDays)
              : "",
        });

        colorVariantsRef.current.forEach(releaseVariantPreviews);

        variantIdRef.current = 0;
        setColorVariants(hydrateVariants(data));
        clearFieldError("colorVariants");
      })
      .catch((err) => console.error("Error fetching product:", err));
  }, [id]);

  useEffect(() => {
    colorVariantsRef.current = colorVariants;
  }, [colorVariants]);

  useEffect(() => {
    return () => {
      colorVariantsRef.current.forEach(releaseVariantPreviews);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingSuppliers(true);
        setSupplierErr("");
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const res = await fetch(`${API_ROOT}/users`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to load suppliers");
        const data = await res.json();
        const list = Array.isArray(data)
          ? data.filter((u) => String(u?.role || "").toLowerCase() === "supplier")
          : [];
        setSuppliers(list);
      } catch (e) {
        setSupplierErr(e.message || "Could not load suppliers");
      } finally {
        setLoadingSuppliers(false);
      }
    })();
  }, []);

  useEffect(() => {
    const supplierId = product.supplierId;
    if (!supplierId) {
      setSupplierProducts([]);
      setSupplierProductsErr("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingSupplierProducts(true);
        setSupplierProductsErr("");
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const res = await fetch(`${API_ROOT}/supplier-products`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to load supplier products");
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const filtered = list.filter((p) => {
          const sid = p?.supplierId?._id || p?.supplierId;
          return String(sid) === String(supplierId);
        });
        setSupplierProducts(filtered);
      } catch (e) {
        if (!cancelled) setSupplierProductsErr(e.message || "Could not load supplier products");
      } finally {
        if (!cancelled) setLoadingSupplierProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.supplierId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setProduct((prev) => {
        const next = { ...prev, [name]: checked };
        if (name === "expireTrackingEnabled" && !checked) {
          next.expiryDate = "";
          next.expiryReminderDays = "";
        }
        return next;
      });
      clearFieldError(name);
      if (name === "expireTrackingEnabled" && !checked) {
        clearFieldError("expiryDate");
        clearFieldError("expiryReminderDays");
      }
    } else if (name === "expiryReminderDays") {
      if (value === "" || value === null) {
        setProduct((prev) => ({ ...prev, expiryReminderDays: "" }));
        clearFieldError(name);
        return;
      }
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) {
        setErrors((prevErrors) => ({ ...prevErrors, [name]: "Enter a non-negative reminder" }));
        return;
      }
      setProduct((prev) => ({ ...prev, expiryReminderDays: String(Math.floor(numeric)) }));
      clearFieldError(name);
    } else if (name === "supplierId") {
      setProduct((prev) => ({ ...prev, supplierId: value, supplierProductId: "" }));
      clearFieldError(name);
    } else {
      setProduct((prev) => ({ ...prev, [name]: value }));
      clearFieldError(name);
    }
  };

  const updateVariantColor = (index, value) => {
    setColorVariants((prev) =>
      prev.map((variant, idx) => (idx === index ? { ...variant, colorName: value } : variant))
    );
    clearFieldError("colorVariants");
  };

  const addVariant = () => {
    setColorVariants((prev) => [...prev, createVariant()]);
    clearFieldError("colorVariants");
  };

  const removeVariant = (index) => {
    setColorVariants((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      const target = prev[index];
      if (target) {
        releaseVariantPreviews(target);
      }
      return prev.filter((_, idx) => idx !== index);
    });
    clearFieldError("colorVariants");
  };

  const appendVariantImages = (index, fileList) => {
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList).map((file) => {
      if (!Object.prototype.hasOwnProperty.call(file, "previewUrl")) {
        Object.defineProperty(file, "previewUrl", {
          value: URL.createObjectURL(file),
          configurable: true,
          writable: true,
          enumerable: false,
        });
      }
      return file;
    });
    setColorVariants((prev) =>
      prev.map((variant, idx) => {
        if (idx !== index) return variant;
        const nextVariant = {
          ...variant,
          newImages: [...variant.newImages, ...files],
          inputVersion: variant.inputVersion + 1,
        };
        nextVariant.coverSource = computeCoverSelection(nextVariant, variant.coverSource);
        return nextVariant;
      })
    );
    clearFieldError("colorVariants");
  };

  const removeVariantImage = (variantIndex, fileIndex, type = "new") => {
    setColorVariants((prev) =>
      prev.map((variant, idx) => {
        if (idx !== variantIndex) return variant;

        if (type === "existing") {
          const nextExisting = variant.existingImageUrls.filter((_, i) => i !== fileIndex);
          const nextVariant = {
            ...variant,
            existingImageUrls: nextExisting,
            inputVersion: variant.inputVersion + 1,
          };
          nextVariant.coverSource = computeCoverSelection(nextVariant, variant.coverSource);
          return nextVariant;
        }

        const nextFiles = variant.newImages.filter((_, i) => {
          if (i === fileIndex) {
            const file = variant.newImages[i];
            if (file && file.previewUrl) {
              URL.revokeObjectURL(file.previewUrl);
              delete file.previewUrl;
            }
            return false;
          }
          return true;
        });
        const nextVariant = {
          ...variant,
          newImages: nextFiles,
          inputVersion: variant.inputVersion + 1,
        };
        nextVariant.coverSource = computeCoverSelection(nextVariant, variant.coverSource);
        return nextVariant;
      })
    );
    clearFieldError("colorVariants");
  };

  const setVariantCoverFromExisting = (variantIndex, imageIndex) => {
    setColorVariants((prev) =>
      prev.map((variant, idx) => {
        if (idx !== variantIndex) return variant;
        const nextVariant = {
          ...variant,
          existingImageUrls: moveItemToFront(variant.existingImageUrls, imageIndex),
        };
        nextVariant.coverSource = computeCoverSelection(nextVariant, "existing:0");
        return nextVariant;
      })
    );
    clearFieldError("colorVariants");
  };

  const setVariantCoverFromNew = (variantIndex, imageIndex) => {
    setColorVariants((prev) =>
      prev.map((variant, idx) => {
        if (idx !== variantIndex) return variant;
        const nextVariant = {
          ...variant,
          newImages: moveItemToFront(variant.newImages, imageIndex),
        };
        nextVariant.coverSource = computeCoverSelection(nextVariant, "new:0");
        return nextVariant;
      })
    );
    clearFieldError("colorVariants");
  };

  const validateForm = () => {
    const nextErrors = {};
    const trimmedName = product.name.trim();
    const trimmedDescription = product.description.trim();
    const trimmedCategory = product.category.trim();
    const trimmedBrand = product.brand.trim();
    const priceValue = Number(product.price);

    if (trimmedName.length < 2) {
      nextErrors.name = "Enter a valid name (min 2 characters)";
    }

    if (!String(product.price).trim() || !Number.isFinite(priceValue) || priceValue <= 0) {
      nextErrors.price = "Enter a positive value for price";
    }

    if (!trimmedDescription) {
      nextErrors.description = "Description is required";
    }

    if (!trimmedCategory) {
      nextErrors.category = "Category is required";
    }

    if (!trimmedBrand) {
      nextErrors.brand = "Brand is required";
    }

    if (!colorVariants.length) {
      nextErrors.colorVariants = "Add at least one colour";
    } else {
      const seenColours = new Set();
      for (const variant of colorVariants) {
        const label = typeof variant?.colorName === "string" ? variant.colorName.trim() : "";
        if (!label) {
          nextErrors.colorVariants = "Every colour entry needs a name";
          break;
        }
        const key = label.toLowerCase();
        if (seenColours.has(key)) {
          nextErrors.colorVariants = "Colour names must be unique";
          break;
        }
        seenColours.add(key);
        const imageCount = (variant.newImages?.length || 0) + (variant.existingImageUrls?.length || 0);
        if (!imageCount) {
          nextErrors.colorVariants = `Add at least one image for ${label}`;
          break;
        }
      }
    }

    if (product.expireTrackingEnabled) {
      if (!product.expiryDate) {
        nextErrors.expiryDate = "Select an expiry date";
      } else if (product.expiryDate < minExpiryDate) {
        nextErrors.expiryDate = "Expiry date cannot be earlier than today";
      }

      if (
        product.expiryReminderDays !== "" &&
        (!Number.isFinite(Number(product.expiryReminderDays)) || Number(product.expiryReminderDays) < 0)
      ) {
        nextErrors.expiryReminderDays = "Enter a non-negative reminder";
      }
    }

    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    const data = new FormData();
    data.append("name", product.name.trim());
    data.append("price", Number(product.price));
    data.append("description", product.description.trim());
    data.append("category", product.category.trim());
    data.append("brand", product.brand.trim());
    data.append("gender", product.gender);
    data.append("expireTrackingEnabled", product.expireTrackingEnabled ? "true" : "false");
    data.append("expiryDate", product.expireTrackingEnabled ? product.expiryDate : "");
    data.append(
      "expiryReminderDays",
      product.expireTrackingEnabled ? String(product.expiryReminderDays || "") : ""
    );
    data.append("supplierId", product.supplierId || "");
    data.append("supplierProductId", product.supplierProductId || "");

    const variantPayload = colorVariants.map((variant, index) => {
      const label = variant.colorName.trim();
      const parsedCover = parseCoverSelection(variant.coverSource);

      let existingSources = Array.isArray(variant.existingImageUrls)
        ? [...variant.existingImageUrls]
        : [];
      let newFiles = Array.isArray(variant.newImages) ? [...variant.newImages] : [];

      if (parsedCover?.type === "existing" && existingSources[parsedCover.index]) {
        existingSources = moveItemToFront(existingSources, parsedCover.index);
      } else if (parsedCover?.type === "new" && newFiles[parsedCover.index]) {
        newFiles = moveItemToFront(newFiles, parsedCover.index);
      }

      const imageKeys = [];
      newFiles.forEach((file, fileIndex) => {
        const fieldName = `variantImages_${index}_${fileIndex}`;
        data.append(fieldName, file);
        imageKeys.push(fieldName);
      });

      const existing = existingSources.map(toRelativeUploadPath).filter(Boolean);

      return {
        colorName: label,
        imageKeys,
        existingImageUrls: existing,
      };
    });

    data.append("colorVariants", JSON.stringify(variantPayload));

    try {
      const res = await fetch(`${API_ROOT}/products/${id}`, {
        method: "PUT",
        body: data,
      });

      const result = await res.json();
      if (res.ok) {
        alert("✅ Product updated successfully!");
        navigate("/products");
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error("Error updating product:", err);
      alert("Something went wrong!");
    }
  };

  return (
    <div className="update-product-container">
      <h2>Edit product</h2>
      <form onSubmit={handleSubmit} className="update-product-form">
        <div>
          <label htmlFor="product-name">Name</label>
          <input
            id="product-name"
            className="input"
            type="text"
            name="name"
            placeholder="Name"
            value={product.name}
            onChange={handleChange}
            required
          />
          {errors.name ? <p style={errorStyle}>{errors.name}</p> : null}
        </div>

        <div>
          <label htmlFor="product-price">Price</label>
          <input
            id="product-price"
            className="input"
            type="number"
            name="price"
            placeholder="Price"
            value={product.price}
            onChange={handleChange}
            required
          />
          {errors.price ? <p style={errorStyle}>{errors.price}</p> : null}
        </div>

        <div>
          <label htmlFor="product-description">Description</label>
          <textarea
            id="product-description"
            className="input"
            name="description"
            placeholder="Description"
            value={product.description}
            onChange={handleChange}
            required
          />
          {errors.description ? <p style={errorStyle}>{errors.description}</p> : null}
        </div>

        <div>
          <label htmlFor="product-category">Category</label>
          <input
            id="product-category"
            className="input"
            type="text"
            name="category"
            placeholder="Category"
            value={product.category}
            onChange={handleChange}
            required
          />
          {errors.category ? <p style={errorStyle}>{errors.category}</p> : null}
        </div>

        <div>
          <label htmlFor="product-brand">Brand</label>
          <input
            id="product-brand"
            className="input"
            type="text"
            name="brand"
            placeholder="Brand"
            value={product.brand}
            onChange={handleChange}
            required
          />
          {errors.brand ? <p style={errorStyle}>{errors.brand}</p> : null}
        </div>

        <div>
          <label htmlFor="product-gender">Target Gender</label>
          <select
            id="product-gender"
            className="input"
            name="gender"
            value={product.gender}
            onChange={handleChange}
            required
          >
            <option value="Men">Men</option>
            <option value="Female">Female</option>
            <option value="Unisex">Unisex</option>
          </select>
        </div>

        <section className="variant-section">
          <div className="variant-section__header">
            <label>Colour Variants</label>
            <button type="button" className="colour-add" onClick={addVariant}>
              Add Colour
            </button>
          </div>
          {colorVariants.map((variant, index) => {
            const hasExisting = Array.isArray(variant.existingImageUrls) && variant.existingImageUrls.length > 0;
            const hasNew = Array.isArray(variant.newImages) && variant.newImages.length > 0;
            return (
              <div className="variant-card" key={variant.id}>
                <div className="variant-card__row">
                  <div className="variant-card__field">
                    <label htmlFor={`variant-color-${variant.id}`}>Colour name</label>
                    <input
                      id={`variant-color-${variant.id}`}
                      type="text"
                      placeholder="e.g. Olive Green"
                      value={variant.colorName}
                      onChange={(event) => updateVariantColor(index, event.target.value)}
                      required={index === 0}
                    />
                  </div>
                  {colorVariants.length > 1 ? (
                    <button
                      type="button"
                      className="colour-remove"
                      onClick={() => removeVariant(index)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="variant-card__preview">
                  {(() => {
                    const previewSrc = getVariantPreviewSrc(variant);
                    if (previewSrc) {
                      return (
                        <img
                          src={previewSrc}
                          alt={`${variant.colorName || `Colour ${index + 1}`} preview`}
                          loading="lazy"
                        />
                      );
                    }
                    return <span className="muted-text">Add an image to preview this colour.</span>;
                  })()}
                  {variant.colorName ? (
                    <span className="variant-card__preview-label">{variant.colorName}</span>
                  ) : null}
                </div>
                <div className="variant-card__uploads">
                  <input
                    key={`${variant.id}-${variant.inputVersion}`}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => appendVariantImages(index, event.target.files)}
                  />
                  <div className="variant-card__library">
                    {hasExisting ? (
                      <div className="variant-library-group">
                        <p className="muted-text">Existing images</p>
                        <ul className="image-preview-list">
                          {variant.existingImageUrls.map((url, imgIndex) => {
                            const isCover = variant.coverSource === `existing:${imgIndex}`;
                            return (
                              <li
                                key={`existing-${variant.id}-${imgIndex}`}
                                data-cover={isCover ? "true" : "false"}
                              >
                                <span className="image-entry">
                                  <img
                                    src={resolveRemoteImage(url)}
                                    alt={`${variant.colorName || "Colour"} option ${imgIndex + 1}`}
                                  />
                                  <span>{extractFileLabel(url)}</span>
                                </span>
                                <div className="image-entry__actions">
                                  {isCover ? <span className="image-chip">Cover</span> : null}
                                  <button
                                    type="button"
                                    className="chip-action"
                                    onClick={() => setVariantCoverFromExisting(index, imgIndex)}
                                    disabled={isCover}
                                  >
                                    {isCover ? "Cover image" : "Make cover"}
                                  </button>
                                  <button
                                    type="button"
                                    className="chip-action chip-action--danger"
                                    onClick={() => removeVariantImage(index, imgIndex, "existing")}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {hasNew ? (
                      <div className="variant-library-group">
                        <p className="muted-text">New uploads</p>
                        <ul className="image-preview-list">
                          {variant.newImages.map((file, imgIndex) => {
                            const isCover = variant.coverSource === `new:${imgIndex}`;
                            return (
                              <li key={`new-${variant.id}-${imgIndex}`} data-cover={isCover ? "true" : "false"}>
                                <span className="image-entry">
                                  {file.previewUrl ? (
                                    <img
                                      src={file.previewUrl}
                                      alt={`${variant.colorName || "New colour"} upload ${imgIndex + 1}`}
                                    />
                                  ) : null}
                                  <span>{file.name}</span>
                                </span>
                                <div className="image-entry__actions">
                                  {isCover ? <span className="image-chip">Cover</span> : null}
                                  <button
                                    type="button"
                                    className="chip-action"
                                    onClick={() => setVariantCoverFromNew(index, imgIndex)}
                                    disabled={isCover}
                                  >
                                    {isCover ? "Cover image" : "Make cover"}
                                  </button>
                                  <button
                                    type="button"
                                    className="chip-action chip-action--danger"
                                    onClick={() => removeVariantImage(index, imgIndex, "new")}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {!hasExisting && !hasNew ? (
                      <p className="muted-text">No images added for this colour yet.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {errors.colorVariants ? <p style={errorStyle}>{errors.colorVariants}</p> : null}
        </section>

        <fieldset className="expiry-fieldset">
          <legend>Expiration tracking (optional)</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="expireTrackingEnabled"
              checked={product.expireTrackingEnabled}
              onChange={handleChange}
            />
            Track expiry date for this product
          </label>
          {product.expireTrackingEnabled && (
            <div className="expiry-controls">
              <div>
                <label htmlFor="product-expiry-date">Expiry date</label>
                <input
                  id="product-expiry-date"
                  className="input"
                  type="date"
                  name="expiryDate"
                  value={product.expiryDate}
                  onChange={handleChange}
                  min={minExpiryDate}
                  required
                />
              </div>
              {errors.expiryDate ? <p style={errorStyle}>{errors.expiryDate}</p> : null}
              <div>
                <label htmlFor="product-expiry-reminder">Reminder days</label>
                <input
                  id="product-expiry-reminder"
                  className="input"
                  type="number"
                  min="0"
                  name="expiryReminderDays"
                  placeholder="e.g. 7"
                  value={product.expiryReminderDays}
                  onChange={handleChange}
                />
              </div>
              {errors.expiryReminderDays ? <p style={errorStyle}>{errors.expiryReminderDays}</p> : null}
            </div>
          )}
        </fieldset>

        <div>
          <label htmlFor="product-supplier">Supplier</label>
          <select
            id="product-supplier"
            className="input"
            name="supplierId"
            value={product.supplierId}
            onChange={handleChange}
            disabled={loadingSuppliers}
          >
            <option value="">-- No supplier selected --</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name || s.email}
              </option>
            ))}
          </select>
          {!!supplierErr && (
            <p className="text-muted" style={{ color: "#92400e" }}>{supplierErr}</p>
          )}
        </div>

        {product.supplierId
          ? (() => {
              const selectedExists = supplierProducts.some(
                (sp) => String(sp._id) === String(product.supplierProductId)
              );
              return (
                <div>
                  <label htmlFor="product-supplier-product">Supplier product</label>
                  <select
                    id="product-supplier-product"
                    className="input"
                    name="supplierProductId"
                    value={product.supplierProductId || ""}
                    onChange={handleChange}
                    disabled={loadingSupplierProducts}
                  >
                    <option value="">-- Select supplier product --</option>
                    {!selectedExists && product.supplierProductId ? (
                      <option value={product.supplierProductId}>
                        Current selection (not in supplier catalog list)
                      </option>
                    ) : null}
                    {supplierProducts.map((sp) => (
                      <option key={sp._id} value={sp._id}>
                        {sp.name} — LKR {Number(sp.price || 0).toLocaleString("en-LK")}
                      </option>
                    ))}
                  </select>
                  {!!supplierProductsErr && (
                    <p className="text-muted" style={{ color: "#92400e" }}>{supplierProductsErr}</p>
                  )}
                  {!loadingSupplierProducts && !selectedExists && product.supplierProductId ? (
                    <p className="text-muted" style={{ color: "#475569" }}>
                      Current supplier product is no longer listed; saving will keep the existing link unless you choose another.
                    </p>
                  ) : null}
                </div>
              );
            })()
          : null}
        <button type="submit" className="btn btn-primary">
          Update product
        </button>
      </form>
    </div>
  );
}

export default UpdateProduct;
