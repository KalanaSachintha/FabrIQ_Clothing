import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Plus,
  ArrowUpRight,
  Heart,
  LayoutGrid,
  ShieldCheck,
  BarChart3,
  Package2,
  Truck,
  Quote
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Home.css";
import { formatLKR } from "../../utils/currency";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

const SERVICE_ITEMS = [
  {
    name: "Merchandising Insights",
    description: "Plan seasonal buys, monitor sell-through in real time, and keep bestsellers in rotation.",
    icon: BarChart3,
    path: "/InventoryDashboard",
    requiresAuth: true,
  },
  {
    name: "Styling Bundles",
    description: "Create mix-and-match outfits in minutes. Build lookbooks with live size availability.",
    icon: Package2,
    path: "/customer-products",
    requiresAuth: false,
  },
  {
    name: "Express Delivery",
    description: "Same-day dispatch for ready-to-wear pieces and transparent courier tracking.",
    icon: Truck,
    path: "/CustomerOrders",
    requiresAuth: true,
  },
  {
    name: "Fit Guarantee",
    description: "Delight shoppers with extended returns and concierge sizing support.",
    icon: ShieldCheck,
    path: "/caredashboard",
    requiresAuth: true,
  },
];

const TESTIMONIALS = [
  {
    id: 1,
    content: "FabrIQ’s trend tracker keeps our boutique stocked with what customers crave. Sell-through is up 35%.",
    author: "Isabella Perera",
    role: "Owner, Velvet & Vine",
  },
  {
    id: 2,
    content: "We style corporate wardrobes in half the time. The live size matrix makes coordinating Fittings effortless.",
    author: "Naveen Jayasuriya",
    role: "Head Stylist, Atelier",
  },
  {
    id: 3,
    content: "Next-day drops and proactive stock alerts mean our online shoppers never see a sold-out banner.",
    author: "Amaya Fernando",
    role: "Ecommerce Lead, Aura",
  },
];

const FALLBACK_PRODUCTS = [
  {
    id: "fallback-1",
    name: "Luxe Linen Blazer",
    description: "Tailored linen blend with breathable lining.",
    price: 32990,
    category: "Blazers",
    brand: "FabrIQ Studio",
    imageUrl: "/images/logoo.png",
  },
  {
    id: "fallback-2",
    name: "Silk Midi Dress",
    description: "Bias-cut satin silk that drapes beautifully.",
    price: 28450,
    category: "Dresses",
    brand: "Celest",
    imageUrl: "/images/logoo.png",
  },
  {
    id: "fallback-3",
    name: "Everyday Denim Jacket",
    description: "Vintage wash denim with adaptive stretch.",
    price: 18750,
    category: "Outerwear",
    brand: "Northline",
    imageUrl: "/images/logoo.png",
  },
  {
    id: "fallback-4",
    name: "Heritage Leather Sneakers",
    description: "Hand-finished leather uppers, memory foam insoles.",
    price: 21990,
    category: "Footwear",
    brand: "Stride",
    imageUrl: "/images/logoo.png",
  },
];

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [counts, setCounts] = useState({ men: 0, women: 0 });

  const apiImageRoot = useMemo(() => API_ROOT, []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProducts() {
      try {
        setLoadingProducts(true);
        const response = await fetch(`${API_ROOT}/products`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Unable to load products (${response.status})`);
        }

        const data = await response.json();
        const allItems = Array.isArray(data) ? data : [];
        
        const menCount = allItems.filter(p => p.gender === "Men").length;
        const womenCount = allItems.filter(p => p.gender === "Female").length;
        setCounts({ men: menCount, women: womenCount });

        const items = allItems.slice(0, 4);
        setFeaturedProducts(items.length ? items : FALLBACK_PRODUCTS);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Failed to load featured products:", error);
        setFeaturedProducts(FALLBACK_PRODUCTS);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProducts(false);
        }
      }
    }

    fetchProducts();
    return () => controller.abort();
  }, []);

  const resolveProductImage = (imagePath) => {
    if (!imagePath) return "/images/logoo.png";
    if (/^https?:\/\//i.test(imagePath)) return imagePath;
    return `${apiImageRoot}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
  };

  const handleBrowseProducts = () => navigate("/customer-products");

  const handleServiceNavigation = (service) => {
    if (!service.path) return;
    if (service.requiresAuth && !user) {
      navigate("/login");
      return;
    }
    navigate(service.path);
  };

  const handleDashboardRedirect = () => {
    if (user) {
      const role = user.role?.toLowerCase();
      if (role === "admin") navigate("/AdminDashboard");
      else if (role === "supplier") navigate("/SupplierDashboard");
      else if (role === "customer care manager") navigate("/caredashboard");
      else navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="home-page">
      <div className="premium-container">

        {/* HERO SECTION */}
        <section className="hero-card">
          <div className="hero-bg-text">GRAY</div>

          <div className="hero-main-text">
            <div className="hero-nav">
              <div className="nav-capsule" onClick={() => navigate("/customer-products?gender=Men")}>
                Men <span>{counts.men} items</span>
              </div>
              <div className="nav-capsule" onClick={() => navigate("/customer-products?gender=Female")}>
                Women <span>{counts.women} items</span>
              </div>
            </div>

            <div className="hero-title-group">
              <h1 className="hero-title-main">
                Gray<br />
                Free
              </h1>
              <span className="hero-discount-badge">Get 80% Off</span>
            </div>

            <p className="hero-description">
              This Black Friday, elevate your style with exclusive offers on our curated clothing collections.
            </p>

            <div className="hero-actions-row">
              <button className="shop-now-btn" onClick={handleBrowseProducts}>
                Shop now
                <div className="arrow-icon">
                  <ArrowRight size={16} />
                </div>
              </button>
              <button className="ghost-btn-premium" onClick={handleDashboardRedirect}>
                {user ? "Open Dashboard" : "Partner Portal"}
                <ArrowUpRight size={18} />
              </button>
            </div>
          </div>

          <div className="hero-image-wrapper">
            <img
              src="/images/premium-hoodie.png"
              alt="Premium Hoodie"
              className="hero-product-image"
            />

            <div className="float-card">
              <div className="float-card-img">
                <img src="/images/premium-hoodie.png" alt="Small Thumbnail" />
              </div>
              <div className="float-card-title">Men's Taped Hoodie</div>
              <div className="float-card-price">{formatLKR(12500)}</div>
              <div className="arrow-circle">
                <ArrowUpRight size={16} />
              </div>
            </div>
          </div>
        </section>

        {/* STATS SECTION */}
        <section className="stats-banner-premium">
          <div className="stat-item">
            <strong>2K+</strong>
            <span>Styles ready to ship</span>
          </div>
          <div className="stat-item">
            <strong>98%</strong>
            <span>On-time delivery rate</span>
          </div>
          <div className="stat-item">
            <strong>24/7</strong>
            <span>Stylist support</span>
          </div>
          <div className="stat-item">
            <strong>150+</strong>
            <span>Global Brands</span>
          </div>
        </section>

        {/* SERVICES SECTION */}
        <section className="premium-section" id="services">
          <div className="premium-section-header">
            <div>
              <h2>Retail Excellence</h2>
              <p>Comprehensive support from curation to delivery</p>
            </div>
          </div>
          <div className="premium-services">
            {SERVICE_ITEMS.map((service) => (
              <div className="service-glass-card" key={service.name} onClick={() => handleServiceNavigation(service)}>
                <div className="service-icon-box"><service.icon size={24} /></div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <div className="service-card-arrow"><ArrowRight size={18} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURED SECTION */}
        <section className="featured-section">
          <div className="premium-section-header">
            <div>
              <h2>Fresh Arrivals</h2>
              <p>Exploring the best trends for the upcoming season</p>
            </div>
            <div className="hero-nav">
              <div className="nav-capsule" onClick={handleBrowseProducts}>
                See All <LayoutGrid size={14} />
              </div>
            </div>
          </div>

          <div className="premium-grid">
            {loadingProducts
              ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="premium-product-card skeleton"></div>
              ))
              : featuredProducts.map((product) => {
                const imageSrc = resolveProductImage(product.imageUrl);
                const productId = product._id || product.id;
                return (
                  <article className="premium-product-card" key={productId} onClick={() => navigate(`/product/${productId}`)}>
                    <div className="premium-product-img">
                      <img src={imageSrc} alt={product.name} />
                    </div>
                    <div className="premium-product-info">
                      <span className="category">{product.category || "Apparel"}</span>
                      <h3>{product.name}</h3>
                      <div className="premium-product-footer">
                        <span className="premium-product-price">{formatLKR(product.price)}</span>
                        <div className="add-to-cart-small">
                          <Plus size={18} />
                        </div>
                      </div>
                    </div>
                    <div className="wishlist-btn-small">
                      <Heart size={20} />
                    </div>
                  </article>
                );
              })}
          </div>
        </section>

        {/* TESTIMONIALS SECTION */}
        <section className="premium-section">
          <div className="premium-section-header" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <div>
              <h2>Trusted by Industry Leaders</h2>
            </div>
          </div>
          <div className="premium-testimonials">
            {TESTIMONIALS.map((t) => (
              <div className="testimonial-premium-card" key={t.id}>
                <Quote size={32} className="quote-icon-premium" />
                <p className="testimonial-text">{t.content}</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{t.author.charAt(0)}</div>
                  <div>
                    <strong>{t.author}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="bottom-cta-premium">
          <div className="cta-bg-text">STYLE</div>
          <div className="cta-content-inner">
            <h2>Ready to elevate your fashion operations?</h2>
            <p>Join thousands of retail teams using FabrIQ to streamline their collections and delivery.</p>
            <div className="cta-buttons-premium">
              <button className="shop-now-btn" onClick={handleBrowseProducts}>Explore Catalogue</button>
              <button className="solid-button-white" onClick={handleDashboardRedirect}>Partner with us</button>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}

export default Home;
