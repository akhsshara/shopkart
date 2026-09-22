// Auth middleware: protects private routes.
// Flow: read cookie -> verify JWT -> load customer -> attach req.user.

const jwt = require('jsonwebtoken');
const Customer = require('../models/customer.model');

async function protect(req, res, next) {
  try {
    // 1. Read JWT from HttpOnly cookie (set at login)
    const token = req.cookies && req.cookies.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    // 2. Verify signature + expiry using the server secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Load customer, exclude password so it never leaks downstream
    const customer = await Customer.findById(decoded.id).select('-password');
    if (!customer) {
      return res.status(401).json({ success: false, message: 'Not authorized, customer not found' });
    }

    // 4. Attach to request for controllers (e.g. GET /me)
    req.user = customer;
    next();
  } catch (err) {
    // TokenExpiredError / JsonWebTokenError both mean 401 (don't leak details)
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
}

module.exports = protect;
