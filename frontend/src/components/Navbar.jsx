import { Link, useNavigate } from 'react-router-dom';
import { logoutCustomer } from '../services/api';

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutCustomer(); // clears HttpOnly cookie on backend
    } catch {
      // Even if API fails, force redirect to login (cookie likely gone)
    }
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/home" className="brand">
        ShopKart
      </Link>
      <div className="nav-links">
        <Link to="/home">Home</Link>
        <Link to="/products">Products</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
        <button className="btn btn-outline" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
