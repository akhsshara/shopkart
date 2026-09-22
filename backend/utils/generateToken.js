// Generate a JWT and store it in an HttpOnly cookie.
// Keeps token logic in one place so controllers stay clean.

const jwt = require('jsonwebtoken');

function generateToken(res, customerId) {
  // Payload is minimal: only the customer id (never put passwords in JWT)
  const token = jwt.sign({ id: customerId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token', token, {
    httpOnly: true, // JS in browser cannot read it -> protects from XSS theft
    secure: isProduction, // send cookie only over HTTPS in production
    sameSite: 'strict', // blocks cross-site cookie sending -> protects from CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT expiry
  });

  return token;
}

module.exports = generateToken;
