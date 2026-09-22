// Customer routes: URL -> controller mapping.
// `protect` guard runs before private handlers (GET /me, PATCH /change-password).

const express = require('express');
const {
  registerCustomer,
  loginCustomer,
  getProfile,
  logoutCustomer,
  changePassword,
} = require('../controllers/customer.controller');
const protect = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', registerCustomer);
router.post('/login', loginCustomer);
router.get('/me', protect, getProfile);
router.post('/logout', logoutCustomer);
router.patch('/change-password', protect, changePassword);

module.exports = router;
