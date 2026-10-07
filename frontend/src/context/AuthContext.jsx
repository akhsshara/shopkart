// Authentication context (Lab 02, reused by Labs 04/05/06).
//
// Single source of truth for "who is logged in". It calls GET /customers/me
// once on mount, which is what the Navbar, the route guards and /home read - so
// the profile is never fetched separately in several places.
//
// The JWT itself lives in an HttpOnly cookie, so there is no token in JS state
// and nothing sensitive is stored in localStorage.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // `initialising` covers the very first render only. The JWT is in an HttpOnly
  // cookie, so React cannot know who is signed in until it asks the backend.
  // Without this flag the route guard would treat "not asked yet" as "not
  // logged in" and bounce a valid session to /login on every refresh.
  const [initialising, setInitialising] = useState(true);
  const [loading, setLoading] = useState(false);

  // GET /customers/me returns the safe customer document directly.
  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/customers/me');
      const u = data.customer ?? data;
      setUser(u && u._id ? u : null);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Hydrate the session on mount, otherwise `user` stays null until the customer
  // logs in again in this tab and every hard refresh bounces to /login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchMe();
      if (!cancelled) setInitialising(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await api.post('/customers/logout'); // clears the HttpOnly cookie
    } catch {
      // Even if the request fails, drop local state - the session is unusable.
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, setLoading, initialising, fetchMe, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthContext;