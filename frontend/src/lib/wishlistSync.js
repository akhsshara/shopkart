// ---------------------------------------------------------------------------
// Wishlist read-cache + invalidation signal (Lab 04).
//
// Lab 04 explicitly forbids solving the wishlist with Redux / Context / any
// global state-management library, so there is no <WishlistProvider> here and
// no wishlist reducer to mirror. Every component still talks to the backend
// directly and treats MongoDB as the single source of truth.
//
// So what IS this file? It is a read-through cache of the *saved product ids*
// plus a pub/sub "the wishlist changed" signal. It exists for one concrete
// reason: /products renders N cards, and if each card called GET /wishlist to
// discover whether its product was already saved we would fire N requests and
// still be guessing. The cache is populated once per session and thrown away on
// logout; mutations never write to it, they only invalidate it.
//
// If it ever grows a mutation API of its own it has become a store and should
// be replaced with real client-state tooling. Cart (Lab 05) took that route -
// see context/CartContext.jsx.
// ---------------------------------------------------------------------------

import api from '../services/api';

const listeners = new Set();

// null = "not loaded yet". [] = loaded, customer has saved nothing.
let cachedIds = null;
let inFlight = null;

function emit() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // one broken listener must never break the mutation that triggered it
    }
  }
}

/** Subscribe to wishlist invalidations. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Announce that the backend wishlist changed. Listeners re-read from the API,
 * so this deliberately passes no data - a stale count can never be displayed.
 */
export function notifyChanged() {
  cachedIds = null;
  inFlight = null;
  emit();
}

/** Drop the cache (logout, or a different customer signing in). */
export function reset() {
  cachedIds = null;
  inFlight = null;
  emit();
}

/** Fetch GET /wishlist once and remember only the ids. Concurrent callers share one request. */
export function ensureLoaded() {
  if (cachedIds) return Promise.resolve(cachedIds);
  if (inFlight) return inFlight;

  inFlight = api
    .get('/wishlist')
    .then(({ data }) => {
      cachedIds = (data.wishlist ?? []).map((p) => p._id);
      return cachedIds;
    })
    .catch(() => {
      // A failed prefetch must never break a card render. Leave the cache
      // empty-but-loaded so we do not hammer the API on every scroll tick.
      cachedIds = [];
      return cachedIds;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Last known saved ids. Empty until ensureLoaded() resolves. */
export function peek() {
  return cachedIds ?? [];
}

/** Prime the cache from a page that already fetched the full list. */
export function seed(products) {
  cachedIds = (products ?? []).map((p) => p._id);
}