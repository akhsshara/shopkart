import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import useWishlistAction from '../hooks/useWishlistAction';
import { formatPrice } from '../lib/format';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, isPending, quantityOf } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartError, setCartError] = useState('');

  const { saved, saving: wishSaving, error: wishError, toggle: toggleWishlist } =
    useWishlistAction(id, Boolean(user));

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/products/${id}`);
        if (active) setProduct(data.product);
      } catch (err) {
        if (active) {
          const status = err.response?.status;
          setError(
            status === 404
              ? 'Product not found.'
              : status === 400
                ? 'Invalid product ID.'
                : err.response?.data?.message || 'Something went wrong while loading products.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const requireLogin = () => {
    if (user) return true;
    navigate('/login');
    return false;
  };

  const handleAddToCart = async () => {
    if (!requireLogin()) return;
    setCartError('');
    const result = await addToCart(id);
    if (!result.ok) setCartError(result.message);
  };

  const handleWishlist = () => {
    if (!requireLogin()) return;
    toggleWishlist();
  };

  if (loading) return <div className="page"><p>Loading products...</p></div>;
  if (error)
    return (
      <div className="page">
        <p className="error">{error}</p> <Link to="/products">Back</Link>
      </div>
    );
  if (!product) return <div className="page"><p>No products found.</p></div>;

  const outOfStock = product.stock <= 0;
  const cartSaving = isPending(product._id);
  const inCart = quantityOf(product._id) > 0;

  return (
    <div className="page">
      <div className="details">
        <img src={product.image} alt={product.name} />
        <div>
          <h2>{product.name}</h2>
          <p className="muted">{product.category}</p>
          <p className="price">{formatPrice(product.price)}</p>
          <p>{product.description}</p>
          <p className={outOfStock ? 'out' : 'in'}>
            {product.stock > 0 ? `${product.stock} units in stock` : 'Out of stock'}
          </p>

          {user ? (
            <>
              <div className="actions-row">
                <button
                  className="btn"
                  type="button"
                  disabled={outOfStock || cartSaving}
                  onClick={handleAddToCart}
                >
                  {outOfStock
                    ? 'Out of stock'
                    : cartSaving
                      ? 'Adding...'
                      : inCart
                        ? 'Add Another'
                        : 'Add to Cart'}
                </button>
                <button
                  className="btn btn-outline-dark"
                  type="button"
                  disabled={wishSaving}
                  onClick={handleWishlist}
                  aria-pressed={saved}
                >
                  {wishSaving ? 'Saving...' : saved ? '♥ Remove from Wishlist' : '♡ Add to Wishlist'}
                </button>
                <Link className="btn btn-outline-dark" to="/cart">
                  Go to Cart
                </Link>
              </div>
              {cartError && <p className="error">{cartError}</p>}
              {wishError && <p className="error">{wishError}</p>}
            </>
          ) : (
            <p className="muted">
              <Link to="/login">Login</Link> to add this product to your cart or wishlist.
            </p>
          )}

          <p>
            <Link to="/products">Back to products</Link>
          </p>
        </div>
      </div>
    </div>
  );
}