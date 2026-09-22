// ShopKart Secure - entry point
// Loads env vars, connects MongoDB, mounts routes, handles errors.

const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const customerRoutes = require('./routes/customer.routes');
const productRoutes = require('./routes/product.routes');
const errorMiddleware = require('./middlewares/error.middleware');

// Load variables from .env into process.env (never hardcode secrets)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---- Global middlewares ----
app.use(express.json()); // parse JSON request bodies
app.use(cookieParser()); // parse cookies -> req.cookies

// CORS must allow the React dev server + cookies (withCredentials: true).
// FRONTEND_URL can be set in .env; defaults to Vite's http://localhost:5173.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Health-check route (useful for viva / Postman)
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'ShopKart Secure API is running' });
});

// ---- Feature routes (MVC: routes -> controllers) ----
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);

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

    await mongoose.connect(process.env.MONGO_URI);
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
