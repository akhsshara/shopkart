import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/format';

// Cart page (Lab 05). It renders ONLY from the shared CartContext - it never
// calls /cart itself, so the Navbar badge and this list can never disagree.
export default function Cart() {
  const navigate = useNavigate();
  const {
    cartItems,
    loading,
    error,
    setError,
    isPending,
    subtotal,
    totalUnits,
    updateQuantity,
    removeFromCart,
    refreshCart,
  } = useCart();

  const [stepError, setStepError] = useState('');

  // + can never exceed the latest stock, - can never go below 1 (Remove is the
  // explicit way to drop a quantity-1 line).
  const handleIncrease = async (item) => {
    setStepError('');
    if (item.quantity + 1 > item.product.stock) {
      setStepError(`Only ${item.product.stock} in stock for ${item.product.name}.`);
      return;
    }
    const result = await updateQuantity(item.product._id, item.quantity + 1);
    if (!result.ok) setStepError(result.message);
  };

  const handleDecrease = async (item) => {
    setStepError('');
    if (item.quantity - 1 < 1) {
      setStepError('Minimum quantity is 1. Use Remove to delete this item.');
      return;
    }
    const result = await updateQuantity(item.product._id, item.quantity - 1);
    if (!result.ok) setStepError(result.message);
  };

  const handleRemove = async (item) => {
    setStepError('');
    const result = await removeFromCart(item.product._id);
    if (!result.ok) setStepError(result.message);
  };

  return (
    <div className="page wide-page">
      <h2>Shopping Cart</h2>

      {loading && <p className="muted">Loading your cart...</p>}

      {!loading && error && (
        <>
          <p className="error">{error}</p>
          <button className="btn btn-outline-dark" type="button" onClick={refreshCart}>
            Retry
          </button>
          <button className="link-btn" type="button" onClick={() => setError('')}>
            Dismiss
          </button>
        </>
      )}

      {!loading && !error && cartItems.length === 0 && (
        <div className="empty-state">
          <p>Your cart is empty.</p>
          <Link className="btn" to="/products">
            Browse products
          </Link>
        </div>
      )}

      {!loading && !error && cartItems.length > 0 && (
        <>
          {stepError && <p className="error">{stepError}</p>}

          <div className="list">
            {cartItems.map((item) => {
              const busy = isPending(item.product._id);
              return (
                <div className="row" key={item.product._id}>
                  <img src={item.product.image} alt={item.product.name} loading="lazy" />
                  <div className="row-info">
                    <h3>{item.product.name}</h3>
                    <p className="muted">{item.product.category}</p>
                    <p className="price">{formatPrice(item.product.price)}</p>
                    <p className={item.product.stock > 0 ? 'in' : 'out'}>
                      {item.product.stock > 0 ? `${item.product.stock} in stock` : 'Out of stock'}
                    </p>
                  </div>

                  <div className="row-actions">
                    <div className="qty">
                      <button
                        type="button"
                        onClick={() => handleDecrease(item)}
                        disabled={busy || item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span>{busy ? '...' : item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleIncrease(item)}
                        disabled={busy || item.quantity >= item.product.stock}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <p className="line-total">{formatPrice(item.product.price * item.quantity)}</p>
                    <Link className="btn btn-outline-dark" to={`/products/${item.product._id}`}>
                      View
                    </Link>
                    <button
                      className="btn btn-outline-dark"
                      type="button"
                      onClick={() => handleRemove(item)}
                      disabled={busy}
                    >
                      {busy ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="summary">
            <p>
              Total items: <strong>{totalUnits}</strong>
            </p>
            <p className="price big">
              Subtotal: <strong>{formatPrice(subtotal)}</strong>
            </p>
            <button className="btn" type="button" onClick={() => navigate('/checkout')}>
              Proceed to Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}