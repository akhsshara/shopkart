// Centralized API client (Lab 02 -> Lab 06).
// withCredentials: true is REQUIRED so the browser sends/receives the
// HttpOnly `token` cookie on every cross-origin request (5173 -> 5000).
//
// This is the ONLY place axios is created - pages, components, contexts and
// hooks all import this instance, so there is exactly one API client in the app.
//
// baseURL must stay ABSOLUTE. It cannot be made relative ("/"): /products,
// /cart, /wishlist and /orders are BOTH API paths and React routes, so
// proxying them would make a page navigation like http://localhost:5173/products
// return the backend's JSON instead of index.html and the SPA would never boot.
//
// That leaves cross-origin requests, which the browser only allows if the
// backend's CORS origin list contains the frontend's origin - see
// backend/index.js.

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Pull a human-readable message out of an axios error (fallback included).
export function getApiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.message || fallback;
}

export default api;