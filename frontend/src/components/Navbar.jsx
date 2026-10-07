import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ensureLoaded, peek, subscribe, reset as resetWishlist } from '../lib/wishlistSync';
import api from '../services/api';

export default function Navbar() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Cart count comes from CartContext, which is already hydrated from GET /cart.
  // The Navbar deliberately does NOT fetch the cart itself - one shared source
  // of truth is the whole point of Lab 05.
  const { totalUnits, loading: cartLoading } = useCart();

  // Wishlist count is read on demand from the backend (see lib/wishlistSync.js).
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    if (!user) {
      resetWishlist();
      setWishlistCount(0);
      return undefined;
    }

    let cancelled = false;
    const load = () => {
      ensureLoaded().then(() => {
        if (!cancelled) setWishlistCount(peek().length);
      });
    };

    load();
    const unsubscribe = subscribe(load);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, location.pathname]);

  const handleLogout = async () => {
    try {
      // Backend clears the HttpOnly cookie; must send credentials.
      await api.post('/customers/logout');
    } catch {
      // even if the API fails, clear client state
    } finally {
      setUser(null);
      resetWishlist();
      navigate('/login', { replace: true });
    }
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <nav className="navbar">
      <Link to={user ? '/home' : '/products'} className="brand">
        <span className="brand-mark">SK</span>
        <span className="brand-name">ShopKart</span>
      </Link>

      <div className="nav-links">
        {!user ? (
          <>
            <NavLink path="/products" isActive={isActive} label="Products" />
            <NavLink path="/login" isActive={isActive} label="Login" />
            <Link className="btn btn-primary btn-sm" to="/register">
              Create Account
            </Link>
          </>
        ) : (
          <>
            <span className="nav-user">{user.email}</span>
            <NavLink path="/home" isActive={isActive} label="Home" />
            <NavLink path="/products" isActive={isActive} label="Products" />
            <NavLink
              path="/wishlist"
              isActive={isActive}
              label="Wishlist"
              badge={wishlistCount}
            />
            {/* totalUnits = sum of quantities, i.e. Cart (3) for kbd x2 + mouse x1 */}
            <NavLink
              path="/cart"
              isActive={isActive}
              label="Cart"
              badge={totalUnits}
              loading={cartLoading}
            />
            <NavLink path="/orders" isActive={isActive} label="Orders" />
            <button className="btn btn-outline" type="button" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

// Declared outside the component: a function defined inside render would be
// recreated on every Navbar render.
function NavLink({ path, label, isActive, badge, loading }) {
  return (
    <Link to={path} className={isActive(path) ? 'nav-link active' : 'nav-link'}>
      <span>{label}</span>
      <Badge count={badge} loading={loading} />
    </Link>
  );
}

function Badge({ count, loading }) {
  if (!count || count <= 0) return null;
  return <span className="nav-badge">{loading ? '...' : count}</span>;
}