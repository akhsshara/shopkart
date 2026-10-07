import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { notifyChanged, seed } from '../lib/wishlistSync';
import { formatPrice } from '../lib/format';

// Wishlist page (Lab 04).
// Deliberately page-local state - the wishlist is NOT a global store, exactly as
// the lab requires. It reads and writes the real API.
export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/wishlist');
        if (!active) return;
        const wishlist = data.wishlist ?? [];
        setItems(wishlist);
        // Prime the shared id cache so every card + the Navbar know the state.
        seed(wishlist);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Unable to load your wishlist.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleRemove = async (productId) => {
    setRemovingId(productId);
    try {
      await api.delete(`/wishlist/${productId}`);
      setItems((prev) => prev.filter((item) => item._id !== productId));
      notifyChanged(); // keep the Navbar badge + every card in sync
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to remove this product.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="page wide-page">
      <h2>My Wishlist</h2>

      {loading && <p className="muted">Loading your wishlist...</p>}

      {!loading && error && (
        <>
          <p className="error">{error}</p>
          <button className="btn btn-outline-dark" type="button" onClick={() => setError('')}>
            Dismiss
          </button>
        </>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          <p>Your wishlist is empty.</p>
          <Link className="btn" to="/products">
            Browse products
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="list">
          {items.map((item) => (
            <div className="row" key={item._id}>
              <img src={item.image} alt={item.name} loading="lazy" />
              <div className="row-info">
                <h3>{item.name}</h3>
                <p className="muted">{item.category}</p>
                <p className="price">{formatPrice(item.price)}</p>
                <p className={item.stock > 0 ? 'in' : 'out'}>
                  {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                </p>
              </div>
              <div className="row-actions">
                <Link className="btn" to={`/products/${item._id}`}>
                  View Details
                </Link>
                <button
                  className="btn btn-outline-dark"
                  type="button"
                  onClick={() => handleRemove(item._id)}
                  disabled={removingId === item._id}
                >
                  {removingId === item._id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}