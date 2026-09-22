// Centralized API client (Lab 02 + Lab 03).
// withCredentials: true is REQUIRED so the browser sends/receives the
// HttpOnly `token` cookie on every cross-origin request (5173 -> 5000).

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Auth ----
export const registerCustomer = (data) => api.post('/customers/register', data);
export const loginCustomer = (data) => api.post('/customers/login', data);
export const fetchProfile = () => api.get('/customers/me');
export const logoutCustomer = () => api.post('/customers/logout');

// ---- Products (Lab 03) ----
export const fetchProducts = (params = {}) => api.get('/products', { params });
export const fetchProductById = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post('/products', data);

export default api;
