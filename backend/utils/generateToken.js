// Generate a JWT for a customer. Pure function: it returns the token string and
// never touches the response, so the cookie flags live in the login controller
// (where they can be seen and reasoned about together).
//
// Payload is minimal: only the customer id. Never put a password in a JWT.

const jwt = require('jsonwebtoken');

function generateToken(customer) {
  return jwt.sign({ id: customer._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

module.exports = generateToken;