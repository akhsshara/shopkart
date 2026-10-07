// GLOBAL CART STATE (Lab 05).
//
// The cart is the first genuinely application-wide piece of data in ShopKart:
// ProductCard writes to it, the Navbar counts it, the Cart page edits it and
// Checkout empties it. Keeping a separate copy in each of those components is
// how you end up with "Navbar says Cart (2)" above a 3-unit cart, so there is
// exactly ONE source of truth here.
//
//   cartItems             - server state, persisted in MongoDB on the Customer
//   subtotal / totalUnits - DERIVED on every render, never persisted: a stored
//                           subtotal goes stale the instant a price changes.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user, initialising } = useAuth();

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Ids with an in-flight mutation, so one row can show "Adding..." without
  // freezing the whole cart.
  const [pendingIds, setPendingIds] = useState([]);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const markPending = (productId, active) =>
    setPendingIds((prev) =>
      active ? [...new Set([...prev, productId])] : prev.filter((id) => id !== productId)
    );

  const refreshCart = useCallback(async () => {
    // Wait until the session is resolved: acting on a not-yet-known `user`
    // would wipe the cart of a signed-in customer on every page refresh.
    if (initialising) return;

    if (!user) {
      if (mounted.current) {
        setCartItems([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/cart');
      // { success, count, cart: [{ product: {...}, quantity }] }
      if (mounted.current) setCartItems(data.cart ?? []);
    } catch (err) {
      if (mounted.current) setError(err.response?.data?.message || 'Unable to load your cart.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user, initialising]);

  // Fetch once the session is known, and wipe on logout so the next customer
  // never sees the previous one's cart in the UI.
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Every mutation adopts the authoritative cart the backend just returned
  // instead of patching locally, so server validation (stock limits, duplicate
  // merge) is never second-guessed.
  const mutate = useCallback(async (productId, request) => {
    markPending(productId, true);
    try {
      const { data } = await request();
      if (mounted.current) setCartItems(data.cart ?? []);
      return { ok: true, message: data.message };
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong. Please try again.';
      if (mounted.current) setError(message);
      return { ok: false, message };
    } finally {
      if (mounted.current) markPending(productId, false);
    }
  }, []);

  // POST /cart/:productId - the backend increments if the product is present.
  const addToCart = useCallback((productId) => mutate(productId, () => api.post(`/cart/${productId}`)), [mutate]);

  // PATCH /cart/:productId
  const updateQuantity = useCallback(
    (productId, quantity) => mutate(productId, () => api.patch(`/cart/${productId}`, { quantity })),
    [mutate]
  );

  // DELETE /cart/:productId
  const removeFromCart = useCallback(
    (productId) => mutate(productId, () => api.delete(`/cart/${productId}`)),
    [mutate]
  );

  // After a VERIFIED payment the backend has already emptied the persisted cart.
  // Clear locally so the Navbar badge drops to Cart (0) immediately instead of
  // waiting for a refetch or a page refresh.
  const clearCart = useCallback(() => setCartItems([]), []);

  const isInCart = useCallback(
    (productId) => cartItems.some((item) => item.product?._id === productId),
    [cartItems]
  );

  const quantityOf = useCallback(
    (productId) => cartItems.find((item) => item.product?._id === productId)?.quantity ?? 0,
    [cartItems]
  );

  // ---- Derived values (memoised so Navbar + Cart page share one computation) ----
  const { subtotal, totalUnits } = useMemo(
    () =>
      cartItems.reduce(
        (acc, item) => {
          const price = item.product?.price ?? 0;
          const qty = item.quantity ?? 0;
          return { subtotal: acc.subtotal + price * qty, totalUnits: acc.totalUnits + qty };
        },
        { subtotal: 0, totalUnits: 0 }
      ),
    [cartItems]
  );

  const value = useMemo(
    () => ({
      cartItems,
      loading,
      error,
      setError,
      pendingIds,
      isPending: (productId) => pendingIds.includes(productId),
      refreshCart,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      isInCart,
      quantityOf,
      subtotal,
      totalUnits,
    }),
    [
      cartItems,
      loading,
      error,
      pendingIds,
      refreshCart,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      isInCart,
      quantityOf,
      subtotal,
      totalUnits,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

export default CartContext;