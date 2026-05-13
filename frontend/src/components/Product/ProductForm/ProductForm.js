import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./ProductForm.css";

const getTodayInputValue = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
const ADD_NEW_CATEGORY_VALUE = "__ADD_NEW_CATEGORY__";

function ProductForm() {
  const variantIdRef = useRef(0);
  const createVariant = (overrides = {}) => ({
    id: variantIdRef.current++,
    colorName: "",
    newImages: [],
    existingImageUrls: [],
    inputVersion: 0,
    ...overrides,
  });

  const [formData, setFormData] = useState({
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
  const [colorVariants, setColorVariants] = useState(() => [createVariant()]);
  const [errors, setErrors] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierErr, setSupplierErr] = useState("");
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loadingSupplierProducts, setLoadingSupplierProducts] = useState(false);
  const [supplierProductsErr, setSupplierProductsErr] = useState("");
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryErr, setCategoryErr] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

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

  useEffect(() => {
    (async () => {
      try {
        setLoadingSuppliers(true);
        // Fetch users and filter by supplier role (admin-only endpoint ideally)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_ROOT}/users`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        const list = Array.isArray(data)
          ? data.filter((u) => String(u?.role || '').toLowerCase() === 'supplier')
          : [];
        setSuppliers(list);
      } catch (e) {
        setSupplierErr(e.message || 'Could not load suppliers');
      } finally {
        setLoadingSuppliers(false);
      }
    })();
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      setCategoryErr("");
      const res = await fetch(`${API_ROOT}/products/categories`);
      if (!res.ok) {
        throw new Error(`Failed to load categories (${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.categories)
        ? data.categories
        : [];
      setCategories(list);
    } catch (error) {
      setCategoryErr(error.message || "Could not load categories");
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Load supplier products whenever a supplier is selected
  useEffect(() => {
    const supplierId = formData.supplierId;
    if (!supplierId) {
      setSupplierProducts([]);
      setSupplierProductsErr("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setSupplierProductsErr("");
        setLoadingSupplierProducts(true);
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_ROOT}/supplier-products`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed to load supplier products');
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const filtered = list.filter((p) => {
          const sid = p?.supplierId?._id || p?.supplierId;
          return String(sid) === String(supplierId);
        });
        setSupplierProducts(filtered);
      } catch (e) {
        if (!cancelled) setSupplierProductsErr(e.message || 'Could not load supplier products');
      } finally {
        if (!cancelled) setLoadingSupplierProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.supplierId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "category") {
      return; // handled separately
    }
    if (name === "customCategory") {
      return; // handled separately
    }
    if (type === "checkbox") {
      setFormData((prev) => {
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
      return;
    }

    if (name === "expiryReminderDays") {
      if (value === "" || value === null) {
        setFormData((prev) => ({ ...prev, expiryReminderDays: "" }));
        clearFieldError(name);
        return;
      }
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) {
        setErrors((prevErrors) => ({ ...prevErrors, [name]: "Enter a non-negative reminder" }));
        return;
      }
      setFormData((prev) => ({ ...prev, expiryReminderDays: String(Math.floor(numeric)) }));
      clearFieldError(name);
      return;
    }

    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "supplierId") {
        next.supplierProductId = "";
      }
      return next;
    });
    clearFieldError(name);
  };

  const handleCategorySelect = (event) => {
    const { value } = event.target;
    clearFieldError("category");
    if (value === ADD_NEW_CATEGORY_VALUE) {
      setUseCustomCategory(true);
      setFormData((prev) => ({ ...prev, category: customCategory.trim() }));
      return;
    }

    setUseCustomCategory(false);
    setCustomCategory("");
    setFormData((prev) => ({ ...prev, category: value }));
  };

  const handleCustomCategoryChange = (event) => {
    const { value } = event.target;
    setCustomCategory(value);
    setFormData((prev) => ({ ...prev, category: value }));
    clearFieldError("category");
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
      return prev.filter((_, idx) => idx !== index);
    });
    clearFieldError("colorVariants");
  };

  const appendVariantImages = (index, fileList) => {
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList);
    setColorVariants((prev) =>
      prev.map((variant, idx) =>
        idx === index
          ? {
              ...variant,
              newImages: [...variant.newImages, ...files],
              inputVersion: variant.inputVersion + 1,
            }
          : variant
      )
    );
    clearFieldError("colorVariants");
  };

  const removeVariantImage = (variantIndex, fileIndex, type = "new") => {
    setColorVariants((prev) =>
      prev.map((variant, idx) => {
        if (idx !== variantIndex) return variant;

        if (type === "existing") {
          const nextExisting = variant.existingImageUrls.filter((_, i) => i !== fileIndex);
          return {
            ...variant,
            existingImageUrls: nextExisting,
            inputVersion: variant.inputVersion + 1,
          };
        }

        const nextFiles = variant.newImages.filter((_, i) => i !== fileIndex);
        return {
          ...variant,
          newImages: nextFiles,
          inputVersion: variant.inputVersion + 1,
        };
      })
    );
    clearFieldError("colorVariants");
  };

  const validateForm = () => {
    const nextErrors = {};
    const trimmedName = formData.name.trim();
    const trimmedDescription = formData.description.trim();
    const trimmedCategory = formData.category.trim();
    const trimmedBrand = formData.brand.trim();
    const priceValue = Number(formData.price);

    if (trimmedName.length < 2) {
      nextErrors.name = "Enter a valid name (min 2 characters)";
    }

    if (!String(formData.price).trim() || !Number.isFinite(priceValue) || priceValue <= 0) {
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

    if (formData.expireTrackingEnabled) {
      if (!formData.expiryDate) {
        nextErrors.expiryDate = "Select an expiry date";
      } else if (formData.expiryDate < minExpiryDate) {
        nextErrors.expiryDate = "Expiry date cannot be earlier than today";
      }

      if (
        formData.expiryReminderDays !== "" &&
        (!Number.isFinite(Number(formData.expiryReminderDays)) || Number(formData.expiryReminderDays) < 0)
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

    const trimmedName = formData.name.trim();
    const trimmedDescription = formData.description.trim();
    const trimmedCategory = formData.category.trim();
    const trimmedBrand = formData.brand.trim();
    const data = new FormData();
    data.append("name", trimmedName);
    data.append("price", Number(formData.price));
    data.append("description", trimmedDescription);
    data.append("category", trimmedCategory);
    data.append("brand", trimmedBrand);
    data.append("gender", formData.gender);
    data.append("expireTrackingEnabled", formData.expireTrackingEnabled ? "true" : "false");
    data.append("expiryDate", formData.expireTrackingEnabled ? formData.expiryDate : "");
    data.append(
      "expiryReminderDays",
      formData.expireTrackingEnabled ? String(formData.expiryReminderDays || "") : ""
    );
    const variantPayload = colorVariants.map((variant, index) => {
      const label = variant.colorName.trim();
      const imageKeys = [];
      (variant.newImages || []).forEach((file, fileIndex) => {
        const fieldName = `variantImages_${index}_${fileIndex}`;
        data.append(fieldName, file);
        imageKeys.push(fieldName);
      });
      return {
        colorName: label,
        imageKeys,
        existingImageUrls: variant.existingImageUrls || [],
      };
    });
    data.append("colorVariants", JSON.stringify(variantPayload));
    if (formData.supplierId) {
      data.append("supplierId", formData.supplierId);
    }
    if (formData.supplierProductId) {
      data.append("supplierProductId", formData.supplierProductId);
    }

    try {
      const res = await fetch(`${API_ROOT}/products`, { method: "POST", body: data });
      const result = await res.json();
      if (res.ok) {
        const submittedCategory = formData.category.trim();
        alert("Product added successfully!");
        setFormData({
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
        variantIdRef.current = 0;
        setColorVariants([createVariant()]);
        setErrors({});
        setUseCustomCategory(false);
        setCustomCategory("");
        if (submittedCategory && !categories.includes(submittedCategory)) {
          setCategories((prev) => [...prev, submittedCategory].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
        }
      } else alert(result.message);
    } catch (err) {
      console.error(err);
      alert("Something went wrong!");
    }
  };

  return (
    <div className="product-form-container">
      <div className="form-heading">
        <h2>Add New Product</h2>
        <p className="muted-text">Create a new listing for your store catalog</p>
      </div>
      <form onSubmit={handleSubmit}>
      <input type="text" name="name" placeholder="Name" value={formData.name} onChange={handleChange} required />
      {errors.name ? <p style={errorStyle}>{errors.name}</p> : null}
      <input type="number" name="price" placeholder="Price" value={formData.price} onChange={handleChange} required />
      {errors.price ? <p style={errorStyle}>{errors.price}</p> : null}
      <input type="text" name="description" placeholder="Description" value={formData.description} onChange={handleChange} required />
      {errors.description ? <p style={errorStyle}>{errors.description}</p> : null}
      <select
        name="category"
        value={useCustomCategory ? ADD_NEW_CATEGORY_VALUE : formData.category}
        onChange={handleCategorySelect}
        disabled={loadingCategories}
        required
      >
        <option value="">-- Select category --</option>
        {categories.map((categoryOption) => (
          <option key={categoryOption} value={categoryOption}>
            {categoryOption}
          </option>
        ))}
        <option value={ADD_NEW_CATEGORY_VALUE}>+ Add new category</option>
      </select>
      {useCustomCategory ? (
        <input
          type="text"
          name="customCategory"
          placeholder="Enter new category"
          value={customCategory}
          onChange={handleCustomCategoryChange}
          required
        />
      ) : null}
      {loadingCategories ? <p className="muted-text">Loading categories…</p> : null}
      {categoryErr ? <p className="muted-text" style={{ color: "#92400e" }}>{categoryErr}</p> : null}
      {errors.category ? <p style={errorStyle}>{errors.category}</p> : null}
      <input type="text" name="brand" placeholder="Brand" value={formData.brand} onChange={handleChange} required />
      {errors.brand ? <p style={errorStyle}>{errors.brand}</p> : null}

      <div className="form-group">
        <label>Target Gender</label>
        <select name="gender" value={formData.gender} onChange={handleChange} required>
          <option value="Men">Men</option>
          <option value="Female">Female</option>
          <option value="Unisex">Unisex</option>
        </select>
      </div>

      <section className="variant-section">
        <div className="variant-section__header">
          <label>Colour Variants</label>
          <button type="button" onClick={addVariant} className="colour-add">
            Add Colour
          </button>
        </div>
        {colorVariants.map((variant, index) => {
          const hasExisting = Array.isArray(variant.existingImageUrls) && variant.existingImageUrls.length > 0;
          const hasNew = Array.isArray(variant.newImages) && variant.newImages.length > 0;
          return (
            <div className="variant-card" key={variant.id}>
              <div className="variant-card__row">
                <input
                  type="text"
                  placeholder="Colour (e.g. Navy Blue)"
                  value={variant.colorName}
                  onChange={(event) => updateVariantColor(index, event.target.value)}
                  required={index === 0}
                />
                {colorVariants.length > 1 ? (
                  <button type="button" onClick={() => removeVariant(index)} className="colour-remove">
                    Remove
                  </button>
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
                          const label = url.split("/").pop() || url;
                          return (
                            <li key={`existing-${variant.id}-${imgIndex}`}>
                              <span>{label}</span>
                              <button
                                type="button"
                                className="chip-action"
                                onClick={() => removeVariantImage(index, imgIndex, "existing")}
                              >
                                Remove
                              </button>
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
                        {variant.newImages.map((file, imgIndex) => (
                          <li key={`new-${variant.id}-${imgIndex}`}>
                            <span>{file.name}</span>
                            <button
                              type="button"
                              className="chip-action"
                              onClick={() => removeVariantImage(index, imgIndex, "new")}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
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
        <label>
          <input
            type="checkbox"
            name="expireTrackingEnabled"
            checked={formData.expireTrackingEnabled}
            onChange={handleChange}
          />
          Track expiry date for this product
        </label>
        {formData.expireTrackingEnabled && (
          <div className="expiry-controls">
            <input
              type="date"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              min={minExpiryDate}
              required
            />
            {errors.expiryDate ? <p style={errorStyle}>{errors.expiryDate}</p> : null}
            <input
              type="number"
              name="expiryReminderDays"
              min="0"
              placeholder="Reminder days"
              value={formData.expiryReminderDays}
              onChange={handleChange}
            />
            {errors.expiryReminderDays ? <p style={errorStyle}>{errors.expiryReminderDays}</p> : null}
          </div>
        )}
      </fieldset>

      <div className="form-group">
        <label>Supplier (internal)</label>
        <select name="supplierId" value={formData.supplierId} onChange={handleChange} disabled={loadingSuppliers}>
          <option value="">-- No supplier selected --</option>
          {suppliers.map((s) => (
            <option key={s._id} value={s._id}>{s.name || s.email}</option>
          ))}
        </select>
        {!!supplierErr && <div className="muted" style={{ color: '#92400e' }}>{supplierErr}</div>}
      </div>
      {formData.supplierId && (
        <div className="form-group">
          <label>Supplier Product (SKU)</label>
          <select
            name="supplierProductId"
            value={formData.supplierProductId || ""}
            onChange={handleChange}
            disabled={loadingSupplierProducts}
          >
            <option value="">-- Select supplier product --</option>
            {supplierProducts.map((sp) => (
              <option key={sp._id} value={sp._id}>
                {sp.name} — LKR {Number(sp.price || 0).toLocaleString('en-LK')}
              </option>
            ))}
          </select>
          {!!supplierProductsErr && <div className="muted" style={{ color: '#92400e' }}>{supplierProductsErr}</div>}
        </div>
      )}
      <button type="submit">Add Product</button>
    </form>
    </div>
  );
}

export default ProductForm;
