const bcrypt = require('bcrypt');
const Customer = require('../models/customer.model');
const generateToken = require('../utils/generateToken');

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Remove password before returning customer data
function toSafeCustomer(customerDoc) {
  const obj =
    typeof customerDoc.toObject === 'function'
      ? customerDoc.toObject()
      : { ...customerDoc };

  delete obj.password;
  return obj;
}

// Cookie settings shared by login and logout
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
}

// POST /customers/register
async function registerCustomer(req, res, next) {
  try {
    let { fullName, email, password, phone } = req.body;

    fullName = typeof fullName === 'string' ? fullName.trim() : fullName;
    email = typeof email === 'string' ? email.trim().toLowerCase() : email;
    phone = typeof phone === 'string' ? phone.trim() : phone;

    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const existing = await Customer.findOne({ email });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    const customer = await Customer.create({
      fullName,
      email,
      password,
      phone,
    });

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customer: toSafeCustomer(customer),
    });
  } catch (err) {
    next(err);
  }
}

// POST /customers/login
async function loginCustomer(req, res, next) {
  try {
    let { email, password } = req.body;

    email = typeof email === 'string' ? email.trim().toLowerCase() : email;

    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await bcrypt.compare(password, customer.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(customer);

    res.cookie('token', token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      customer: toSafeCustomer(customer),
    });
  } catch (err) {
    next(err);
  }
}

// GET /customers/me (protected)
async function getProfile(req, res) {
  return res.status(200).json(toSafeCustomer(req.user));
}

// POST /customers/logout
async function logoutCustomer(req, res) {
  const options = getCookieOptions();
  delete options.maxAge;

  res.clearCookie('token', options);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

// PATCH /customers/change-password (protected)
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Old and new passwords are required',
      });
    }

    if (
      typeof newPassword !== 'string' ||
      newPassword.length < 6
    ) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    const customer = await Customer.findById(req.user._id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const isMatch = await bcrypt.compare(
      oldPassword,
      customer.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Old password is incorrect',
      });
    }

    customer.password = newPassword;
    await customer.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
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
