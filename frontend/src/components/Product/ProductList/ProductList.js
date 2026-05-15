import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./ProductList.css";
import { formatLKR } from "../../../utils/currency";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const resolveUrl = (path) => {
  if (!path) return "";
  if (/^data:image\//i.test(path)) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ROOT}${path.startsWith("/") ? "" : "/"}${path}`;
};

const resolveProductImage = (product) => {
  if (Array.isArray(product?.colorVariants) && product.colorVariants.length) {
    const withImages = product.colorVariants.find(
      (variant) => Array.isArray(variant?.imageUrls) && variant.imageUrls.length
    );
    const candidate = withImages?.imageUrls?.[0];
    if (candidate) {
      return resolveUrl(candidate);
    }
  }

  if (Array.isArray(product?.galleryImageUrls) && product.galleryImageUrls.length) {
    const candidate = product.galleryImageUrls[0];
    if (candidate) {
      return resolveUrl(candidate);
    }
  }

  if (product?.imageUrl) {
    return resolveUrl(product.imageUrl);
  }

  return "";
};

function ProductList() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${API_ROOT}/products`)
      .then((res) => setProducts(res.data))
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await axios.delete(`${API_ROOT}/products/${id}`);
      setProducts(products.filter((p) => p._id !== id));
    } catch (err) {
      console.error("Error deleting product:", err);
    }
  };

  const handleUpdate = (id) => {
    navigate(`/update-product/${id}`);
  };

  const filteredProducts = products
    .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "asc") return a.price - b.price;
      if (sortOrder === "desc") return b.price - a.price;
      return 0;
    });

  return (
    <div className="product-list-page">
      <header className="product-list-header">
        <div className="product-list-header__titles">
          <p className="product-list-kicker">Catalog</p>
          <h1 className="heading-lg">Store products</h1>
          <p className="muted-text">
            Browse and manage every item available in your storefront. Search, sort, or update entries without leaving this view.
          </p>
        </div>
        <div className="product-list-header__actions">
          <div className="search-sort">
            <input
              type="text"
              placeholder="Search products by name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="">Sort by price</option>
              <option value="asc">Low to High</option>
              <option value="desc">High to Low</option>
            </select>
          </div>
          <Link to="/add-product" className="btn btn-primary btn-sm">
            ➕ Add product
          </Link>
        </div>
      </header>

      <section className="product-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <article key={product._id} className="product-card">
              <div className="product-card__media">
                {(() => {
                  const imageSrc = resolveProductImage(product);
                  if (imageSrc) {
                    return (
                      <img
                        src={imageSrc}
                        alt={product.name}
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    );
                  }
                  return <div className="product-card__placeholder" aria-hidden="true">🧵</div>;
                })()}
              </div>
              <div className="product-card__body">
                <div className="product-card__title-group">
                  <h2>{product.name}</h2>
                  <span className="product-card__price">{formatLKR(product.price)}</span>
                </div>
                <dl className="product-card__meta">
                  <div>
                    <dt>Brand</dt>
                    <dd>{product.brand || "—"}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{product.category || "—"}</dd>
                  </div>
                  <div>
                    <dt>Gender</dt>
                    <dd>{product.gender || "Unisex"}</dd>
                  </div>
                  <div>
                    <dt>Colours</dt>
                    <dd>
                      {(() => {
                        const colourSource = Array.isArray(product?.colorVariants) && product.colorVariants.length
                          ? product.colorVariants.map((variant) => variant?.colorName).filter(Boolean)
                          : Array.isArray(product?.availableColors)
                          ? product.availableColors.filter(Boolean)
                          : [];
                        if (!colourSource.length) {
                          return "—";
                        }
                        const uniqueColours = Array.from(new Set(colourSource.map((label) => String(label))));
                        const visibleColours = uniqueColours.slice(0, 4);
                        const remaining = uniqueColours.length - visibleColours.length;
                        return (
                          <div className="product-card__colors">
                            {visibleColours.map((colour) => (
                              <span key={colour} className="product-card__color-chip">{colour}</span>
                            ))}
                            {remaining > 0 ? (
                              <span className="product-card__color-chip product-card__color-chip--more">+{remaining}</span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </dd>
                  </div>
                </dl>
              </div>
              <footer className="product-card__actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleUpdate(product._id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleDelete(product._id)}
                >
                  Delete
                </button>
              </footer>
            </article>
          ))
        ) : (
          <div className="product-grid__empty">
            <p className="muted-text">No products match your filters. Try adjusting your search.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default ProductList;
