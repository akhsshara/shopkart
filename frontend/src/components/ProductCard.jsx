import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import useWishlistAction from '../hooks/useWishlistAction';
import { formatPrice } from '../lib/format';

export default function ProductCard({ product }) {
  const { _id, name, price, category, image, stock } = product;

  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToCart, isPending, quantityOf } = useCart();

  const {
    saved,
    saving: wishSaving,
    error: wishError,
    setError: setWishError,
    toggle,
  } = useWishlistAction(_id, Boolean(user));

  const [cartError, setCartError] = useState('');
  const cartSaving = isPending(_id);
  const inCart = quantityOf(_id) > 0;

  // Wishlist and cart are protected APIs - send anonymous visitors to login
  // rather than firing a request that can only ever return 401.
  const requireLogin = () => {
    if (user) return true;
    navigate('/login');
    return false;
  };

  const handleAddToCart = async () => {
    if (!requireLogin()) return;
    setCartError('');
    const result = await addToCart(_id);
    if (!result.ok) setCartError(result.message);
  };

  const handleWishlist = () => {
    if (!requireLogin()) return;
    setCartError('');
    toggle();
  };

  const stockLabel =
    stock === 0 ? 'Out of stock' : stock < 10 ? `${stock} units left` : `${stock} in stock`;

  const rowError = wishError || cartError;

  return (
    <div className="card">
      <div className="card-media">
        <img src={image} alt={name} loading="lazy" />
        <button
          type="button"
          className={saved ? 'wish-btn saved' : 'wish-btn'}
          onClick={handleWishlist}
          disabled={wishSaving}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
          title={saved ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          {wishSaving ? '...' : saved ? '♥' : '♡'}
        </button>
      </div>

      <div className="card-body">
        <p className="cat">{category}</p>
        <h3>{name}</h3>

        <div className="card-meta">
          <span className="price">{formatPrice(price)}</span>
          <span className={stock === 0 ? 'out' : stock < 10 ? 'low' : 'in'}>{stockLabel}</span>
        </div>

        {rowError && (
          <p className="error small" role="alert">
            {rowError}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setWishError('');
                setCartError('');
              }}
            >
              Dismiss
            </button>
          </p>
        )}

        <div className="card-actions">
          <Link className="btn btn-outline-dark" to={`/products/${_id}`}>
            View Details
          </Link>
          <button
            type="button"
            className="btn"
            onClick={handleAddToCart}
            disabled={stock === 0 || cartSaving}
          >
            {stock === 0 ? 'Out of Stock' : cartSaving ? 'Adding...' : inCart ? 'Add Another' : 'Add to Cart'}
          </button>
        </div>

        {/* Wishlist status line, so the action is not icon-only. */}
        <p className="wish-status">
          {wishSaving ? (
            <span className="muted">Saving...</span>
          ) : saved ? (
            <button type="button" className="link-btn saved" onClick={handleWishlist}>
              ♥ Added to Wishlist
            </button>
          ) : (
            <button type="button" className="link-btn" onClick={handleWishlist}>
              ♡ Add to Wishlist
            </button>
          )}
        </p>
      </div>
    </div>
  );
}