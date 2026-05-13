import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MoreVertical,
  Moon,
  ShoppingCart,
  Sun,
  UserCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CartContext } from "../Order/Customer/CartContext";
import { AdminCartContext } from "../Order/Admin/AdminCartContext";
import "./Header.css";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const authRoutes = ["/login", "/register", "/register-supplier"];
  
  const { user, logout, theme, toggleTheme, deleteAccount } = useAuth();
  const { cartItems: customerCartItems } = useContext(CartContext) || { cartItems: [] };
  const { cartItems: adminCartItems } = useContext(AdminCartContext) || { cartItems: [] };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const mobileMenuRef = useRef(null);
  const accountMenuRef = useRef(null);

  const cartCount = useMemo(() => {
    if (!user) return 0;
    const role = (user?.role || "").toLowerCase();
    if (role === "admin") {
      return (adminCartItems || []).reduce((total, item) => total + (item.quantity || 0), 0);
    }
    return (customerCartItems || []).reduce((total, item) => total + (item.quantity || 0), 0);
  }, [customerCartItems, adminCartItems, user]);

  const initials = useMemo(() => {
    const segments = (user?.name || user?.email || "Guest User")
      .trim()
      .split(/\s+/);
    return (
      (segments[0]?.[0] || "G").toUpperCase() +
      (segments[1]?.[0] || "").toUpperCase()
    );
  }, [user?.name, user?.email]);

  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsAccountMenuOpen(false);
  };

  const canDeleteAccount = useMemo(
    () => String(user?.role || "").toLowerCase() === "user",
    [user?.role]
  );

  const handleDeleteAccount = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    const confirmed = window.confirm(
      "Delete your FabrIQ account? This action is permanent and cannot be undone."
    );
    if (!confirmed) return;
    try {
      setIsDeletingAccount(true);
      const response = await deleteAccount();
      closeMenus();
      navigate("/");
      window.alert(response?.message || "Your account has been deleted.");
    } catch (error) {
      window.alert(error.message || "Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }

      if (
        isAccountMenuOpen &&
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen, isAccountMenuOpen]);

  const goto = (path) => {
    navigate(path);
    closeMenus();
  };

  const navigateToSection = (sectionId) => {
    closeMenus();
    if (location.pathname !== "/") {
      navigate("/", { state: { scrollTo: sectionId } });
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDashboardRedirect = () => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Redirect based on user role
    const userRole = (user?.role || "").toLowerCase();
    if (userRole === "admin") {
      navigate("/AdminDashboard");
    } else if (userRole === "supplier") {
      navigate("/SupplierDashboard");
    } else if (userRole === "customer care manager") {
      navigate("/caredashboard");
    } else {
      navigate("/dashboard");
    }
    closeMenus();
  };

  const handleProfileRedirect = () => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Redirect to appropriate dashboard with profile tab
    const userRole = (user?.role || "").toLowerCase();
    if (userRole === "admin") {
      navigate("/AdminDashboard#profile");
    } else if (userRole === "supplier") {
      navigate("/SupplierDashboard#profile");
    } else if (userRole === "customer care manager") {
      navigate("/caredashboard#profile");
    } else {
      navigate("/dashboard#profile");
    }
    closeMenus();
  };

  const handleCartClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    const role = (user?.role || "").toLowerCase();
    if (role === "admin") {
      navigate("/AdminCart");
    } else {
      navigate("/customercart");
    }
    closeMenus();
  };


  const navItems = [
    {
      label: "Home",
      isActive: location.pathname === "/",
      onClick: () => goto("/"),
    },
    {
      label: "Products",
      isActive:
        location.pathname.startsWith("/customer-products") ||
        location.pathname.startsWith("/product/"),
      onClick: () => goto("/customer-products"),
    },
    {
      label: "Services",
      onClick: () => navigateToSection("services"),
    },
    {
      label: "About",
      isActive: location.pathname === "/about",
      onClick: () => goto("/about"),
    },
    {
      label: "AI Design",
      isActive: location.pathname === "/ai-design",
      onClick: () => goto("/ai-design"),
    },
    {
      label: "Design Lab",
      isActive: location.pathname === "/design-lab",
      onClick: () => goto("/design-lab"),
    },
    {
      label: "Bulk Orders",
      isActive: location.pathname === "/bulk-orders",
      onClick: () => goto("/bulk-orders"),
    },
  ];

  const memoizedNavItems = useMemo(() => {
    const role = (user?.role || "").toLowerCase();
    const isAuthorized = role === "admin" || role === "user";

    let filteredNavItems = navItems;
    if (!isAuthorized) {
      filteredNavItems = navItems.filter(item => 
        !["AI Design", "Design Lab", "Bulk Orders"].includes(item.label)
      );
    }

    if (!user) return filteredNavItems;
    
    // Find Home and put Dashboard right after it
    const homeIndex = filteredNavItems.findIndex(i => i.label === "Home");
    const result = [...filteredNavItems];
    
    result.splice(homeIndex + 1, 0, {
      label: "Dashboard",
      isActive: location.pathname.toLowerCase().includes("dashboard"),
      onClick: handleDashboardRedirect,
    });
    
    return result;
  }, [user, location.pathname, navItems, handleDashboardRedirect]);

  if (authRoutes.includes(location.pathname.toLowerCase())) {
    return null;
  }

  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
      <div className="header-inner">
        <div
          className="brand"
          onClick={() => goto("/")}
          role="button"
          tabIndex={0}
        >
          <div className="brand-text">
            <span className="brand-name">FabrIQ</span>
            <span className="brand-subtitle">Your connected fashion hub</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          {memoizedNavItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-link ${item.isActive ? "active" : ""}`}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <div className="icon-cluster">
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              type="button"
              className="icon-button cart-button"
              onClick={handleCartClick}
              aria-label="View cart"
            >
              <ShoppingCart size={16} aria-hidden="true" />
              {cartCount > 0 && <span className="badge">{cartCount}</span>}
            </button>

            {user ? (
              <div className="account-controls" ref={accountMenuRef}>
                <button
                  type="button"
                  className="icon-button profile-button"
                  onClick={handleDashboardRedirect}
                  title="Open dashboard"
                  aria-label="Open dashboard"
                >
                  <UserCircle size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button account-menu-toggle"
                  onClick={() => setIsAccountMenuOpen((open) => !open)}
                  aria-label="Open account menu"
                >
                  <MoreVertical size={16} aria-hidden="true" />
                </button>

                {isAccountMenuOpen && (
                  <div className="account-menu" role="menu">
                    <div className="account-summary">
                      <span className="avatar" aria-hidden="true">{initials}</span>
                      <div>
                        <p>{user?.name || "FabrIQ user"}</p>
                        <span>{user?.email}</span>
                      </div>
                    </div>
                    <button type="button" onClick={handleProfileRedirect} role="menuitem">
                      View profile
                    </button>
                    {canDeleteAccount && (
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        role="menuitem"
                        className="danger"
                        disabled={isDeletingAccount}
                      >
                        {isDeletingAccount ? "Deleting…" : "Delete account"}
                      </button>
                    )}
                    <button type="button" onClick={logout} role="menuitem" className="danger">
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-buttons">
                <button type="button" className="text-button" onClick={() => goto("/login")}>
                  Sign in
                </button>
                <button type="button" className="solid-button" onClick={() => goto("/register")}>Create account</button>
                <button type="button" className="text-button" onClick={() => goto("/register-supplier")}>
                  Become a supplier
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}

export default Header;
