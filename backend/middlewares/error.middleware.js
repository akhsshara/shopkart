// Centralized error-handling middleware.
// Any controller calling next(err) ends up here -> consistent JSON format.
// NOTE: four parameters (err, req, res, next) are required for Express to treat it as an error handler.

function errorMiddleware(err, req, res, next) {
  // Mongoose duplicate-key error (e.g. race-condition duplicate email)
  if (err && err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  // Mongoose validation error (schema required/minlength failures)
  if (err && err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // Malformed ObjectId in a query/path (never leak a 500 stack trace).
  // Controllers already validate ids, this is the safety net.
  if (err && err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID' });
  }

  // CORS rejection (raised by the cors origin callback above)
  if (err && /Not allowed by CORS/.test(err.message || '')) {
    return res.status(403).json({ success: false, message: 'Not allowed by CORS' });
  }

  const statusCode = (err && err.statusCode) || 500;
  const message = (err && err.message) || 'Internal server error';

  // Never log passwords or tokens here - only safe error messages
  res.status(statusCode).json({ success: false, message });
}

module.exports = errorMiddleware;