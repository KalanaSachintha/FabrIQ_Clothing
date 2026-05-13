// src/components/CustomerProductList/CustomerProductList.js
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CartContext } from "../Order/Customer/CartContext";
import "./CustomerProductList.css";
import { formatLKR } from "../../utils/currency";

const resolveImageUrl = (apiRoot, imageUrl = "") => {
  if (!imageUrl) return "";
  if (/^https?:/i.test(imageUrl)) return imageUrl;
  const normalized = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${apiRoot}${normalized}`;
};

const summarizeText = (text = "") => {
  if (!text) return "Tap to explore the full product story.";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
};

const uniqueCount = (items, selector) => {
  return Array.from(new Set(items.map(selector).filter(Boolean))).length;
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
      const normalized = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
      map[label] = normalized;
    });
    return map;
  }

  if (typeof input === "object") {
    Object.entries(input).forEach(([key, value]) => {
      const label = normalizeSizeLabel(key);
      if (!label) return;
      const numeric = Number(value);
      const normalized = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
      map[label] = normalized;
    });
  }

  return map;
};

const makeSizeStateKey = (productId, colourName) => {
  const idPart = productId ? String(productId) : "";
  const colourPart = colourName ? String(colourName) : "";
  return `${idPart}::${colourPart}`;
};

function CustomerProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("search") || "";
  });
  const [sortOrder, setSortOrder] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [priceRange, setPriceRange] = useState([0, 2000]); // Default range
  const [selectedRating, setSelectedRating] = useState(0);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedColours, setSelectedColours] = useState({});
  const [selectedGender, setSelectedGender] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("gender") || "All";
  });
  const [selectedSizes, setSelectedSizes] = useState({});
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useContext(CartContext);
  const normalizedRole = String(user?.role || "").trim().toLowerCase();
  
  // Identify internal staff who should NOT see the Add to Cart button
  const staffRoles = ["admin", "supplier", "finance manager", "sales manager", "inventory manager", "customer care manager", "customer care"];
  const isInternalStaff = user && staffRoles.some(role => normalizedRole.includes(role));

  const API_ROOT = useMemo(
    () => (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, ""),
    []
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`${API_ROOT}/products`)
      .then(async (res) => {
        if (!res.ok) {
          const errMsg = await res.json().catch(() => ({}));
          throw new Error(errMsg.message || "Failed to fetch products");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setProducts(Array.isArray(data) ? data : []);
          // Set max price based on actual data
          if (Array.isArray(data) && data.length > 0) {
            const max = Math.max(...data.map(p => p.price || 0));
            setPriceRange([0, max]);
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching products:", err);
        if (!cancelled) setError(err.message || "Unable to load products");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [API_ROOT]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get("search") || "";
    setSearchTerm((prev) => (prev === query ? prev : query));

    const genderParam = params.get("gender") || "All";
    setSelectedGender((prev) => (prev === genderParam ? prev : genderParam));
  }, [location.search]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return ["All Categories", ...cats];
  }, [products]);

  const brands = useMemo(() => {
    return Array.from(new Set(products.map(p => p.brand).filter(Boolean)));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products
      .filter((product) => {
        const matchesSearch = [product.name, product.brand, product.category]
          .map((value) => value?.toLowerCase() || "")
          .some((value) => value.includes(query));
        
        const matchesCategory = selectedCategory === "All Categories" || product.category === selectedCategory;
        const matchesPrice = (product.price || 0) >= priceRange[0] && (product.price || 0) <= priceRange[1];
        const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(product.brand);
        const matchesGender = selectedGender === "All" || product.gender === selectedGender;
        
        return matchesSearch && matchesCategory && matchesPrice && matchesBrand && matchesGender;
      })
      .sort((a, b) => {
        switch (sortOrder) {
          case "price-asc":
            return (a.price || 0) - (b.price || 0);
          case "price-desc":
            return (b.price || 0) - (a.price || 0);
          case "brand-asc":
            return (a.brand || "").localeCompare(b.brand || "");
          case "brand-desc":
            return (b.brand || "").localeCompare(a.brand || "");
          case "category-asc":
            return (a.category || "").localeCompare(b.category || "");
          case "category-desc":
            return (b.category || "").localeCompare(a.category || "");
          default:
            return 0;
        }
      });
  }, [products, searchTerm, sortOrder, selectedCategory, priceRange, selectedBrands, selectedGender]);

  const handleAddToCart = (product, selectedColor = null, selectedSize = null) => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    addToCart({ ...product, selectedColor, selectedSize });
    navigate("/customercart");
  };

  const handleColourSelect = (productId, variantOrName) => {
    if (!productId) return;
    const colourName =
      typeof variantOrName === "string"
        ? variantOrName
        : typeof variantOrName?.colorName === "string"
        ? variantOrName.colorName
        : "";
    if (!colourName) return;

    setSelectedColours((prev) => {
      if (prev[productId] === colourName) return prev;
      return { ...prev, [productId]: colourName };
    });

    if (variantOrName && typeof variantOrName === "object") {
      const sizeOptions = Array.isArray(variantOrName.sizes) ? variantOrName.sizes : [];
      setSelectedSizes((prev) => {
        const key = makeSizeStateKey(productId, colourName);
        if (!sizeOptions.length) {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        }
        if (prev[key] && sizeOptions.includes(prev[key])) {
          return prev;
        }
        return { ...prev, [key]: sizeOptions[0] };
      });
    }
  };

  const handleSizeSelect = (productId, colourName, size) => {
    if (!productId || !colourName || !size) return;
    const key = makeSizeStateKey(productId, colourName);
    setSelectedSizes((prev) => {
      if (prev[key] === size) return prev;
      return { ...prev, [key]: size };
    });
  };

  const toggleBrand = (brand) => {
    setSelectedBrands(prev => 
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };

  const resetFilters = () => {
    setPriceRange([0, Math.max(...products.map(p => p.price || 0))]);
    setSelectedBrands([]);
    setSelectedRating(0);
    setSelectedGender("All");
    setSelectedCategory("All Categories");
    setSearchTerm("");
  };

  const visitCart = () => navigate("/customercart");

  return (
    <div className="marketplace-container">
      <div className="marketplace-inner">
        {/* Sidebar */}
        <aside className="marketplace-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h3>Price Range</h3>
              <button className="reset-btn" onClick={() => setPriceRange([0, Math.max(...products.map(p => p.price || 0))])}>Reset</button>
            </div>
            <div className="price-slider-container">
              <input 
                type="range" 
                min="0" 
                max={Math.max(...products.map(p => p.price || 0), 2000)} 
                value={priceRange[1]} 
                onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                className="price-slider"
              />
              <div className="price-labels">
                <span className="price-bubble">LKR {priceRange[0]}</span>
                <span className="price-bubble">LKR {priceRange[1]}</span>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h3>Star Rating</h3>
              <button className="reset-btn" onClick={() => setSelectedRating(0)}>Reset</button>
            </div>
            <div className="rating-filter">
              {[5, 4, 3, 2, 1].map(star => (
                <label key={star} className="rating-label">
                  <input 
                    type="radio" 
                    name="rating" 
                    checked={selectedRating === star} 
                    onChange={() => setSelectedRating(star)} 
                  />
                  <div className="stars">
                    {Array.from({ length: star }).map((_, i) => (
                      <span key={i} className="star filled">★</span>
                    ))}
                    {Array.from({ length: 5 - star }).map((_, i) => (
                      <span key={i} className="star">★</span>
                    ))}
                  </div>
                  <span className="rating-text">{star} Stars & up</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h3>Brand</h3>
              <button className="reset-btn" onClick={() => setSelectedBrands([])}>Reset</button>
            </div>
            <div className="brand-list">
              {brands.map(brand => (
                <label key={brand} className="brand-item">
                  <input 
                    type="checkbox" 
                    checked={selectedBrands.includes(brand)} 
                    onChange={() => toggleBrand(brand)} 
                  />
                  <span className="brand-name">{brand}</span>
                  <span className="checkbox-custom"></span>
                </label>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h3>Gender</h3>
              <button className="reset-btn" onClick={() => setSelectedGender("All")}>Reset</button>
            </div>
            <div className="gender-filter">
              {["All", "Men", "Female", "Unisex"].map(gender => (
                <label key={gender} className="gender-label">
                  <input 
                    type="radio" 
                    name="gender" 
                    checked={selectedGender === gender} 
                    onChange={() => setSelectedGender(gender)} 
                  />
                  <span className="gender-text">{gender}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h3>Delivery Options</h3>
            </div>
            <div className="delivery-options">
              <button className="delivery-btn active">Standard</button>
              <button className="delivery-btn">Pick Up</button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="marketplace-main">
          {/* Categories Bar */}
          <nav className="categories-bar">
            {categories.map(cat => (
              <button 
                key={cat} 
                className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </nav>

          {/* Product Grid */}
          <section className="marketplace-grid">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="product-skeleton" />
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="empty-state">
                <h2>No products found</h2>
                <p>Try adjusting your search or filters</p>
                <button className="btn-primary" onClick={resetFilters}>Clear all filters</button>
              </div>
            ) : (
              filteredProducts.map((product, index) => {
                const colorVariants = Array.isArray(product.colorVariants) ? product.colorVariants : [];
                const preferredColour = selectedColours[product._id] || (colorVariants[0]?.colorName || "");
                const activeVariant = colorVariants.find(v => v.colorName === preferredColour) || colorVariants[0];
                const activeSizeMap = toSizeStockMap(activeVariant?.sizeStocks || activeVariant?.sizes);
                const sizeOptions = orderSizes(Object.keys(activeSizeMap));
                
                // Ensure we have a valid default size if none is selected
                const sizeKey = makeSizeStateKey(product._id, preferredColour);
                let preferredSize = selectedSizes[sizeKey];
                
                // If no size selected yet, try to pick the first size that has stock > 0
                if (!preferredSize && sizeOptions.length > 0) {
                  const firstWithStock = sizeOptions.find(sz => activeSizeMap[sz] > 0);
                  preferredSize = firstWithStock || sizeOptions[0];
                }
                
                const currentStock = preferredSize ? (activeSizeMap[preferredSize] || 0) : 0;
                
                const previewCandidate = (activeVariant && activeVariant.images?.[0]) || product.imageUrl;
                const productImageUrl = resolveImageUrl(API_ROOT, previewCandidate);
                
                return (
                  <article key={product._id} className="product-card-modern">
                    <div className="card-image-wrapper">
                      {index % 3 === 0 && <span className="card-badge">Top item</span>}
                      <button className="wishlist-btn">
                        <span style={{ color: '#ef4444' }}>❤️</span>
                      </button>
                      <img src={productImageUrl} alt={product.name} className="product-image" />
                    </div>

                    <div className="card-details">
                      <div className="card-header">
                        <div className="card-id-brand">
                          <span className="product-card__brand">{product.brand || "FabrIQ"}</span>
                          <span className="product-card__price">{formatLKR(product.price)}</span>
                        </div>
                        <h3 className="product-name" onClick={() => navigate(`/product/${product._id}`)}>
                          {product.name}
                        </h3>
                      </div>

                      {/* Swatches Restored */}
                      {colorVariants.length > 0 && (
                        <div className="product-card__swatches">
                          {colorVariants.map((v) => {
                            const variantPreview = resolveImageUrl(API_ROOT, v.imageUrls?.[0] || v.images?.[0]);
                            const initial = v.colorName ? v.colorName.charAt(0).toUpperCase() : "";
                            const hasValidHex = v.hexValue && v.hexValue.trim().length > 0;
                            return (
                              <button
                                key={v.colorName}
                                className={`product-card__swatch ${preferredColour === v.colorName ? "is-active" : ""}`}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleColourSelect(product._id, v); }}
                                title={v.colorName}
                              >
                                <span
                                  className="product-card__swatch-sample"
                                  style={
                                    variantPreview 
                                      ? { backgroundImage: `url(${variantPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' } 
                                      : { backgroundColor: hasValidHex ? v.hexValue : "#e2e8f0", display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: '#475569' }
                                  }
                                >
                                  {!variantPreview && !hasValidHex ? initial : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Sizes Restored */}
                      <div className="product-card__sizes">
                        <div className="product-card__size-options">
                          {sizeOptions.map((sz) => (
                            <button
                              key={sz}
                              className={`product-card__size-chip ${preferredSize === sz ? "is-active" : ""} ${activeSizeMap[sz] < 1 ? "is-sold-out" : ""}`}
                              onClick={() => handleSizeSelect(product._id, preferredColour, sz)}
                              disabled={activeSizeMap[sz] < 1}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Actions Restored */}
                      <div className="product-card__actions">
                        {user && !isInternalStaff && (
                          <button
                            className="btn btn-primary"
                            disabled={currentStock < 1}
                            onClick={() => handleAddToCart(product, preferredColour, preferredSize)}
                          >
                            {currentStock > 0 ? "Add to Cart" : "Out of Stock"}
                          </button>
                        )}
                        <button
                          className="btn btn-ghost"
                          onClick={() => navigate(`/product/${product._id}`)}
                        >
                          Quick look
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </main>
      </div>
    </div>
  );
}


export default CustomerProductList;
