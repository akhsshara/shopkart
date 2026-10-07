const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore fallback error
}

// ShopKart Secure - entry point
// Loads env vars, connects MongoDB, mounts routes, handles errors.

const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const customerRoutes = require('./routes/customer.routes');
const productRoutes = require('./routes/product.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');
const errorMiddleware = require('./middlewares/error.middleware');

// Load variables from .env into process.env (never hardcode secrets)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---- Global middlewares ----
app.use(express.json()); // parse JSON request bodies
app.use(cookieParser()); // parse cookies -> req.cookies

// CORS must allow the React dev server + cookies (withCredentials: true).
// Default allow-list covers the Vite dev ports this project is run on; set
// FRONTEND_URL (comma-separated) in .env to override it.
// The list matters: a request from an origin that is not listed still reaches
// this server and still returns 200 JSON, but the browser withholds the body
// from JS (no Access-Control-Allow-Origin), so axios rejects with a bare
// "Network Error" while DevTools shows a healthy 200.
const allowedOrigins = (
  process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173', 'http://localhost:5199', 'http://localhost:3000']
).filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin/curl/Postman requests have no Origin header - allow them.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // required so the browser sends the token cookie
  })
);

// Health-check route (useful for viva / Postman)
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'ShopKart Secure API is running' });
});

// ---- Feature routes (MVC: routes -> controllers) ----
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);

// Handle unknown routes with consistent JSON format
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Centralized error handler (must be registered LAST)
app.use(errorMiddleware);

// ---- Start server only after MongoDB connects ----
async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing in .env file');
    }
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing in .env file');
    }

    await mongoose.connect(process.env.MONGO_URI.trim());
    console.log('MongoDB connected');

    app.listen(PORT, () => {
      console.log(`ShopKart Secure running on port ${PORT}`);
    });
  } catch (err) {
    // Graceful handling: log safe message (no credentials) and stop
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
