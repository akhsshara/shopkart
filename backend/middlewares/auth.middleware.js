// Auth middleware: protects every private route.
// Flow: read token -> verify JWT -> load customer -> attach req.user.
//
// The token normally arrives as the HttpOnly `token` cookie (set at login).
// An `Authorization: Bearer <token>` header is also accepted so the same API
// can be exercised from Postman/curl without a cookie jar.

const jwt = require('jsonwebtoken');
const Customer = require('../models/customer.model');

async function authenticate(req, res, next) {
  try {
    let token = req.cookies && req.cookies.token;

    if (!token) {
      const header = req.headers.authorization;
      if (header && header.startsWith('Bearer ')) {
        token = header.slice(7).trim();
      }
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // `-password` keeps the hash out of every downstream response by default.
    const customer = await Customer.findById(decoded.id).select('-password');
    if (!customer) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    req.user = customer; // controllers always read the owner from here
    next();
  } catch (err) {
    // jwt.verify throws for expired / tampered / malformed tokens. One generic
    // message for every failure so the response cannot be used as an oracle.
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}

module.exports = authenticate;