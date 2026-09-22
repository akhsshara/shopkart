// Customer controllers (business logic for each endpoint).
// Routes only map URLs -> these functions (MVC separation).

const bcrypt = require('bcrypt');
const Customer = require('../models/customer.model');
const generateToken = require('../utils/generateToken');

// Simple email format check (Mongoose also trims/lowercases)
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /customers/register
async function registerCustomer(req, res, next) {
  try {
    let { fullName, email, password, phone } = req.body;

    // Trim + normalize (email lowercase) so " John@Gmail.com " works cleanly
    fullName = typeof fullName === 'string' ? fullName.trim() : fullName;
    email = typeof email === 'string' ? email.trim().toLowerCase() : email;
    phone = typeof phone === 'string' ? phone.trim() : phone;

    // 1. Validate all fields
    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // 2. Email must be unique -> 409 Conflict
    const existing = await Customer.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // 3. Save (password is hashed by pre('save') hook in the model - never plaintext)
    const customer = await Customer.create({ fullName, email, password, phone });

    // 4. Respond WITHOUT password
    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customer: {
        _id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      },
    });
  } catch (err) {
    next(err); // -> centralized error.middleware.js
  }
}

// POST /customers/login
async function loginCustomer(req, res, next) {
  try {
    let { email, password } = req.body;

    email = typeof email === 'string' ? email.trim().toLowerCase() : email;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Find by normalized email
    const customer = await Customer.findOne({ email });
    // Generic message: do NOT reveal whether email or password was wrong
    // (prevents attackers from discovering which emails are registered)
    if (!customer) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Create JWT + set HttpOnly cookie
    generateToken(res, customer._id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      customer: {
        _id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /customers/me (protected)
async function getProfile(req, res) {
  // req.user was set by auth.middleware (password already excluded)
  res.status(200).json({
    _id: req.user._id,
    fullName: req.user.fullName,
    email: req.user.email,
    phone: req.user.phone,
  });
}

// POST /customers/logout
async function logoutCustomer(req, res) {
  const isProduction = process.env.NODE_ENV === 'production';
  // Must use same flags as login so the browser matches and deletes the cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
}

// PATCH /customers/change-password (protected, bonus)
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Old and new passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    // Need the hash, but auth.middleware excluded it -> fetch again
    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, customer.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Old password is incorrect' });
    }

    // Assign plaintext; pre('save') hook hashes it before writing to MongoDB
    customer.password = newPassword;
    await customer.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerCustomer,
  loginCustomer,
  getProfile,
  logoutCustomer,
  changePassword,
};
