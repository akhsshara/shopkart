import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// /home is wrapped in <ProtectedRoute> in App.jsx, and the profile comes from
// AuthContext (which already ran GET /customers/me), so this page does not fetch
// the customer a second time.
export default function Home() {
  const { user } = useAuth();
  const { totalUnits } = useCart();

  if (!user) return null;

  return (
    <div className="page">
      <div className="form wide">
        <h2>Welcome, {user.fullName}!</h2>
        <p>
          <strong>Name:</strong> {user.fullName}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>Phone:</strong> {user.phone}
        </p>

        <div className="actions-row">
          <Link className="btn" to="/products">
            Browse Products
          </Link>
          <Link className="btn btn-outline-dark" to="/cart">
            Cart ({totalUnits})
          </Link>
          <Link className="btn btn-outline-dark" to="/wishlist">
            Wishlist
          </Link>
          <Link className="btn btn-outline-dark" to="/orders">
            My Orders
          </Link>
        </div>
      </div>
    </div>
  );
}