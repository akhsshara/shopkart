import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { ensureLoaded, peek, subscribe, notifyChanged } from '../lib/wishlistSync';

// One wishlist action (add / remove) shared by ProductCard and ProductDetails.
//
// Lab 04 forbids a global wishlist store, so this hook keeps purely local state
// plus a read of the shared id cache. All mutation logic lives in the hook so
// the two screens cannot drift apart.
export function useWishlistAction(productId, enabled) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Discover the CURRENT saved state once, then follow invalidations. Without
  // this the button would show "Add to Wishlist" for an already-saved product
  // and the first click would silently DELETE it.
  useEffect(() => {
    if (!enabled || !productId) {
      setSaved(false);
      return undefined;
    }
    let cancelled = false;

    ensureLoaded().then(() => {
      if (!cancelled) setSaved(peek().includes(productId));
    });

    const unsubscribe = subscribe(() => {
      if (cancelled) return;
      // Another card (or the wishlist page) mutated the list - re-read the
      // authoritative ids from the backend rather than guessing.
      ensureLoaded().then(() => {
        if (!cancelled) setSaved(peek().includes(productId));
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [productId, enabled]);

  const toggle = useCallback(async () => {
    if (!productId || saving) return; // guard: no duplicate requests
    setSaving(true);
    setError('');
    try {
      if (saved) {
        await api.delete(`/wishlist/${productId}`);
      } else {
        await api.post(`/wishlist/${productId}`);
      }
      // Instant local feedback, then announce the change so the Navbar badge
      // and every other card re-read the saved ids from the backend.
      setSaved(!saved);
      notifyChanged();
    } catch (err) {
      // 409 means "already in wishlist" - the desired end state is satisfied,
      // so treat it as success rather than showing a scary error.
      if (err.response?.status === 409) {
        setSaved(true);
        notifyChanged();
      } else {
        setError(err.response?.data?.message || 'Unable to save product. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [productId, saved, saving]);

  return { saved, saving, error, setError, toggle };
}

export default useWishlistAction;